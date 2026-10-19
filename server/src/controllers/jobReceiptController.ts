import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { Job, IJob } from '../models/Job.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { DeliveryChallan } from '../models/DeliveryChallan.js';
import { MaterialReceipt } from '../models/MaterialReceipt.js';
import { JobReceipt, IJobReceiptCircuitLine, IJobReceiptConsumptionLine, IJobReceiptReturnLine } from '../models/JobReceipt.js';
import { FinishedGoods } from '../models/FinishedGoods.js';
import { FinishedGoodsTransaction } from '../models/FinishedGoodsTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { getNextSequence } from '../utils/sequence.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';
import { applyComponentReturnLine, refreshChallanStatus, ReceiptError } from './receiptController.js';

class IdempotentJobReceiptReplayError extends Error {
  idempotencyKey: string;
  constructor(idempotencyKey: string) {
    super('Idempotent replay of an already-processed job receipt');
    this.name = 'IdempotentJobReceiptReplayError';
    this.idempotencyKey = idempotencyKey;
  }
}

export async function generateJobReceiptNumber(session?: ClientSession | null): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `JRC-${yearMonth}-`;
  const counterKey = `jobreceipt-${yearMonth}`;

  const seq = await getNextSequence(counterKey, {
    session,
    initFrom: async () => {
      const latest = await JobReceipt.findOne({ receiptNumber: { $regex: `^${prefix}` } })
        .sort({ receiptNumber: -1 })
        .select('receiptNumber')
        .session(session || null);
      if (!latest?.receiptNumber) return 0;
      const parts = latest.receiptNumber.split('-');
      const currentSeq = parts.length === 3 ? parseInt(parts[2], 10) : NaN;
      return isNaN(currentSeq) ? 0 : currentSeq;
    },
  });

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

interface RawCircuitReceipt {
  jobCircuitId: string;
  goodQty?: number | string;
  rejectedQty?: number | string;
  rejectionReason?: string;
}

interface RawComponentReturn {
  componentId: string;
  challanId: string;
  receivedQty?: number | string;
  damagedQty?: number | string;
}

interface JobReceiptBody {
  vendorRefNumber?: string;
  circuitReceipts?: RawCircuitReceipt[];
  componentReturns?: RawComponentReturn[];
  remarks?: string;
}

// Combined job-scoped receiving workflow: records finished-circuit good/
// rejected quantities (feeding FinishedGoods + BOM-derived component
// consumption) AND/OR raw component returns against one or more challans,
// in ONE mandatory transaction. Reuses applyComponentReturnLine (the same
// accounting logic the standalone challan-scoped MaterialReceipt flow
// uses) for the component-return portion - no duplicated logic, no second
// implementation to drift out of sync.
export async function performJobReceipt(
  jobId: string,
  body: JobReceiptBody,
  idempotencyKey: string,
  receivedById: mongoose.Types.ObjectId | string
) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new ReceiptError('An idempotency key is required to record a job receipt', 400);
  }

  const rawCircuitReceipts = body.circuitReceipts || [];
  const rawComponentReturns = body.componentReturns || [];

  // Fast path: this exact request already completed.
  const alreadyDone = await JobReceipt.findOne({ idempotencyKey });
  if (alreadyDone) {
    const job = await Job.findById(alreadyDone.jobId);
    return { receipt: alreadyDone, job, alreadyProcessed: true };
  }

  // --- Sanitize circuit receipt lines ---
  const seenCircuits = new Set<string>();
  const sanitizedCircuits: Array<{ jobCircuitId: string; goodQty: number; rejectedQty: number; rejectionReason?: string }> = [];
  for (const raw of rawCircuitReceipts) {
    if (!raw.jobCircuitId || !mongoose.isValidObjectId(raw.jobCircuitId)) {
      throw new ReceiptError('Every circuit receipt line must reference a valid job circuit', 400);
    }
    if (seenCircuits.has(raw.jobCircuitId)) {
      throw new ReceiptError('Duplicate circuit in receipt request - each job circuit may only appear once per receipt', 400);
    }
    seenCircuits.add(raw.jobCircuitId);
    const goodQty = Number(raw.goodQty) || 0;
    const rejectedQty = Number(raw.rejectedQty) || 0;
    if (goodQty < 0 || rejectedQty < 0) {
      throw new ReceiptError('Good and rejected quantities cannot be negative', 400);
    }
    if (goodQty === 0 && rejectedQty === 0) {
      continue; // skip no-op lines rather than erroring, so the UI can submit a full row set
    }
    sanitizedCircuits.push({ jobCircuitId: raw.jobCircuitId, goodQty, rejectedQty, rejectionReason: raw.rejectionReason?.trim() });
  }

  // --- Sanitize component return lines ---
  const seenReturns = new Set<string>();
  const sanitizedReturns: Array<{ componentId: string; challanId: string; receivedQty: number; damagedQty: number }> = [];
  for (const raw of rawComponentReturns) {
    if (!raw.componentId || !mongoose.isValidObjectId(raw.componentId)) {
      throw new ReceiptError('Every component return line must reference a valid component', 400);
    }
    if (!raw.challanId || !mongoose.isValidObjectId(raw.challanId)) {
      throw new ReceiptError('Every component return line must reference its originating delivery challan', 400);
    }
    const key = `${raw.challanId}:${raw.componentId}`;
    if (seenReturns.has(key)) {
      throw new ReceiptError('Duplicate component+challan combination in receipt request', 400);
    }
    seenReturns.add(key);
    const receivedQty = Number(raw.receivedQty) || 0;
    const damagedQty = Number(raw.damagedQty) || 0;
    if (receivedQty < 0 || damagedQty < 0) {
      throw new ReceiptError('Received and damaged quantities cannot be negative', 400);
    }
    if (receivedQty === 0 && damagedQty === 0) continue;
    sanitizedReturns.push({ componentId: raw.componentId, challanId: raw.challanId, receivedQty, damagedQty });
  }

  if (sanitizedCircuits.length === 0 && sanitizedReturns.length === 0) {
    throw new ReceiptError('At least one circuit receipt or component return line with a quantity greater than zero is required', 400);
  }

  try {
    return await withRequiredTransaction(async (session) => {
      const eligibleJob = await Job.findOne({
        _id: jobId,
        status: { $in: ['material_issued', 'partially_received'] },
      }).session(session);
      if (!eligibleJob) {
        const existingJob = await Job.findById(jobId).session(session);
        throw new ReceiptError(
          `Job is '${existingJob?.status}' and cannot receive material/finished circuits. Only Material Issued or Partially Received jobs are eligible.`,
          400
        );
      }

      const receiptNumber = await generateJobReceiptNumber(session);
      const receiptId = new mongoose.Types.ObjectId();

      // --- Circuit receipts: validate against ordered qty, compute BOM
      // consumption, update FinishedGoods ---
      const circuitReceiptLines: IJobReceiptCircuitLine[] = [];
      const consumptionMap = new Map<string, { partCode: string; name: string; qty: number }>();

      for (const c of sanitizedCircuits) {
        const jobCircuit = eligibleJob.jobCircuits.find((jc) => jc._id?.toString() === c.jobCircuitId);
        if (!jobCircuit) {
          throw new ReceiptError('This circuit is not part of this job', 400, { jobCircuitId: c.jobCircuitId });
        }

        const totalThisEvent = c.goodQty + c.rejectedQty;
        const jobCircuitObjectId = new mongoose.Types.ObjectId(c.jobCircuitId);

        // Atomic guard: cumulative good+rejected for this job circuit line
        // must never exceed its ordered quantity, evaluated at write time.
        const updatedForCircuit = await Job.findOneAndUpdate(
          {
            _id: jobId,
            $expr: {
              $let: {
                vars: {
                  jc: {
                    $arrayElemAt: [{ $filter: { input: '$jobCircuits', cond: { $eq: ['$$this._id', jobCircuitObjectId] } } }, 0],
                  },
                },
                in: {
                  $lte: [
                    { $add: ['$$jc.receivedGoodQty', '$$jc.receivedRejectedQty', totalThisEvent] },
                    '$$jc.orderedQty',
                  ],
                },
              },
            },
          },
          {
            $inc: {
              'jobCircuits.$[jc].receivedGoodQty': c.goodQty,
              'jobCircuits.$[jc].receivedRejectedQty': c.rejectedQty,
            },
          },
          { arrayFilters: [{ 'jc._id': jobCircuitObjectId }], session, new: true }
        );

        if (!updatedForCircuit) {
          const remaining = jobCircuit.orderedQty - jobCircuit.receivedGoodQty - jobCircuit.receivedRejectedQty;
          throw new ReceiptError(
            `Cannot receive ${totalThisEvent} of circuit '${jobCircuit.circuitCode}': exceeds remaining ordered quantity (remaining=${remaining})`,
            400,
            { jobCircuitId: c.jobCircuitId, circuitCode: jobCircuit.circuitCode, remaining }
          );
        }

        circuitReceiptLines.push({
          jobCircuitId: jobCircuitObjectId,
          circuitId: jobCircuit.circuitId,
          circuitCode: jobCircuit.circuitCode,
          circuitName: jobCircuit.circuitName,
          circuitVersion: jobCircuit.circuitVersion,
          orderedQty: jobCircuit.orderedQty,
          previouslyGoodQty: jobCircuit.receivedGoodQty,
          previouslyRejectedQty: jobCircuit.receivedRejectedQty,
          goodQty: c.goodQty,
          rejectedQty: c.rejectedQty,
          rejectionReason: c.rejectionReason,
          cumulativeAfter: jobCircuit.receivedGoodQty + jobCircuit.receivedRejectedQty + totalThisEvent,
        } as IJobReceiptCircuitLine);

        // BOM-derived consumption basis = (good + rejected) - a rejected
        // circuit still consumed the raw components to get built; it just
        // failed QC afterward. Aggregate across circuit lines sharing a
        // component (e.g. two different circuits on this job both using
        // the same resistor).
        for (const bomItem of jobCircuit.bomSnapshot) {
          const qty = bomItem.qtyPerUnit * totalThisEvent;
          const key = bomItem.componentId.toString();
          const existing = consumptionMap.get(key);
          if (existing) {
            existing.qty += qty;
          } else {
            consumptionMap.set(key, { partCode: bomItem.partCode, name: bomItem.name, qty });
          }
        }

        // FinishedGoods: only goodQty increases usable balance; rejected is
        // tracked for visibility but never silently inflates good stock.
        const updatedFinishedGoods = await FinishedGoods.findOneAndUpdate(
          { circuitId: jobCircuit.circuitId },
          {
            $inc: { goodQtyBalance: c.goodQty, totalReceivedGoodQty: c.goodQty, totalRejectedQty: c.rejectedQty },
            $setOnInsert: {
              circuitCode: jobCircuit.circuitCode,
              circuitName: jobCircuit.circuitName,
              circuitVersion: jobCircuit.circuitVersion,
            },
          },
          { upsert: true, new: true, session }
        );

        if (c.goodQty > 0) {
          await FinishedGoodsTransaction.create(
            [
              {
                circuitId: jobCircuit.circuitId,
                type: 'received_from_job',
                qtyChange: c.goodQty,
                balanceAfter: updatedFinishedGoods!.goodQtyBalance,
                jobId: eligibleJob._id,
                jobNumber: eligibleJob.jobNumber,
                jobReceiptId: receiptId,
                referenceNo: receiptNumber,
                notes: c.rejectedQty > 0 ? `${c.rejectedQty} rejected in same receipt (reason: ${c.rejectionReason || 'unspecified'})` : undefined,
                createdById: receivedById,
              },
            ],
            { session }
          );
        }
      }

      // --- Apply BOM-derived consumption per component: job-level counter
      // + component withVendorStock write-off + CIRCUIT_CONSUMPTION ledger.
      // Guarded against exceeding issuedQty across returned+damaged+consumed
      // - the central "no double accounting" invariant. ---
      const consumptionLines: IJobReceiptConsumptionLine[] = [];
      for (const [componentIdStr, data] of consumptionMap.entries()) {
        const componentId = new mongoose.Types.ObjectId(componentIdStr);
        const qty = Number(data.qty.toFixed(4));
        if (qty <= 0) continue;

        const materialLine = eligibleJob.materialRequirement.find((m) => m.componentId.toString() === componentIdStr);
        if (!materialLine) {
          throw new ReceiptError(`Component '${data.partCode}' is not part of this job's material requirement`, 400, {
            componentId: componentIdStr,
          });
        }

        const updatedJobForConsumption = await Job.findOneAndUpdate(
          {
            _id: jobId,
            $expr: {
              $let: {
                vars: {
                  line: {
                    $arrayElemAt: [{ $filter: { input: '$materialRequirement', cond: { $eq: ['$$this.componentId', componentId] } } }, 0],
                  },
                },
                in: {
                  $lte: [
                    { $add: ['$$line.returnedQty', '$$line.damagedQty', '$$line.consumedQty', qty] },
                    '$$line.issuedQty',
                  ],
                },
              },
            },
          },
          { $inc: { 'materialRequirement.$[elem].consumedQty': qty } },
          { arrayFilters: [{ 'elem.componentId': componentId }], session, new: true }
        );

        if (!updatedJobForConsumption) {
          const remaining = materialLine.issuedQty - materialLine.returnedQty - materialLine.damagedQty - materialLine.consumedQty;
          throw new ReceiptError(
            `Cannot attribute ${qty} consumption of '${data.partCode}' to this receipt: exceeds remaining unaccounted issued quantity (remaining=${remaining}). This usually means the BOM consumption for the circuits received does not fit within what was actually issued.`,
            400,
            { componentId: componentIdStr, partCode: data.partCode, remaining }
          );
        }

        const updatedComponent = await Component.findOneAndUpdate(
          { _id: componentId, $expr: { $gte: ['$withVendorStock', qty] } },
          { $inc: { withVendorStock: -qty } },
          { new: true, session }
        );

        if (!updatedComponent) {
          const current = await Component.findById(componentId).session(session);
          throw new ReceiptError(
            `Cannot consume ${qty} of '${data.partCode}': exceeds component's with-vendor stock (with-vendor=${current?.withVendorStock ?? 0})`,
            400,
            { componentId: componentIdStr, partCode: data.partCode }
          );
        }

        await StockTransaction.create(
          [
            {
              componentId,
              type: 'CIRCUIT_CONSUMPTION',
              locationType: 'VENDOR',
              vendorId: eligibleJob.vendorId,
              qtyChange: -qty,
              balanceInStoreAfter: updatedComponent.inStoreStock,
              balanceReservedAfter: updatedComponent.reservedStock,
              balanceWithVendorAfter: updatedComponent.withVendorStock,
              referenceType: 'JOB_RECEIPT',
              referenceId: receiptId,
              referenceNo: receiptNumber,
              notes: `Consumed in circuit assembly for job ${eligibleJob.jobNumber}`,
              createdById: receivedById,
            },
          ],
          { session }
        );

        consumptionLines.push({ componentId, partCode: data.partCode, name: data.name, qtyConsumed: qty } as IJobReceiptConsumptionLine);
      }

      // --- Component returns: reuse the SAME accounting logic the
      // standalone challan-scoped flow uses. ---
      const returnLines: IJobReceiptReturnLine[] = [];
      const touchedChallanIds = new Set<string>();
      for (const r of sanitizedReturns) {
        const challan = await DeliveryChallan.findById(r.challanId).session(session);
        if (!challan || challan.jobId.toString() !== jobId) {
          throw new ReceiptError('Delivery challan not found for this job', 404, { challanId: r.challanId });
        }

        const lineResult = await applyComponentReturnLine({
          session,
          challanId: challan._id,
          jobId: eligibleJob._id,
          componentId: new mongoose.Types.ObjectId(r.componentId),
          receivedQty: r.receivedQty,
          damagedQty: r.damagedQty,
          vendorName: challan.vendorName,
          vendorId: challan.vendorId,
          referenceNo: receiptNumber,
          referenceId: receiptId,
          referenceType: 'JOB_RECEIPT',
          receivedById,
        });

        touchedChallanIds.add(challan._id.toString());
        returnLines.push({
          componentId: lineResult.componentId,
          partCode: lineResult.partCode,
          name: lineResult.name,
          challanId: challan._id,
          challanNumber: challan.challanNumber,
          receivedQty: lineResult.receivedQty,
          damagedQty: lineResult.damagedQty,
        } as IJobReceiptReturnLine);
      }

      for (const challanIdStr of touchedChallanIds) {
        await refreshChallanStatus(new mongoose.Types.ObjectId(challanIdStr), session);
      }

      // First receipt against this job flips it to Partially Received.
      // Actual job CLOSING is always a separate, explicit action (never
      // triggered automatically inside a receipt), per the safe-closing
      // requirement.
      if (eligibleJob.status !== 'partially_received') {
        await Job.updateOne({ _id: jobId }, { $set: { status: 'partially_received' } }, { session });
      }

      let receipt;
      try {
        const [created] = await JobReceipt.create(
          [
            {
              _id: receiptId,
              receiptNumber,
              receiptDate: new Date(),
              jobId: eligibleJob._id,
              jobNumber: eligibleJob.jobNumber,
              vendorId: eligibleJob.vendorId,
              vendorRefNumber: body.vendorRefNumber?.trim(),
              circuitReceipts: circuitReceiptLines,
              consumption: consumptionLines,
              componentReturns: returnLines,
              remarks: body.remarks?.trim(),
              idempotencyKey,
              receivedById,
            },
          ],
          { session }
        );
        receipt = created;
      } catch (err: any) {
        if (err.code === 11000) {
          throw new IdempotentJobReceiptReplayError(idempotencyKey);
        }
        throw err;
      }

      const finalJob = await Job.findById(jobId).session(session);
      return { receipt, job: finalJob, alreadyProcessed: false };
    });
  } catch (error: any) {
    if (error instanceof IdempotentJobReceiptReplayError) {
      const existing = await JobReceipt.findOne({ idempotencyKey: error.idempotencyKey });
      if (existing) {
        const job = await Job.findById(existing.jobId);
        return { receipt: existing, job, alreadyProcessed: true };
      }
    }
    throw error;
  }
}

export const receiveJobMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { idempotencyKey, ...body } = req.body;
    const result = await performJobReceipt(String(req.params.id), body, idempotencyKey, req.user!._id);
    const message = result.alreadyProcessed
      ? `Receipt already processed as '${result.receipt.receiptNumber}' (duplicate request ignored)`
      : `Job receipt '${result.receipt.receiptNumber}' recorded`;
    res.status(result.alreadyProcessed ? 200 : 201).json({ message, data: result });
  } catch (error: any) {
    if (error instanceof TransactionUnavailableError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof ReceiptError) {
      res.status(error.status).json({ message: error.message, details: error.details });
      return;
    }
    res.status(500).json({ message: error.message || 'Error recording job receipt' });
  }
};

export const getJobReceiptsByJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receipts = await JobReceipt.find({ jobId: req.params.jobId })
      .populate('receivedById', 'name email')
      .sort({ createdAt: -1 });
    res.json({ data: receipts });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching job receipts' });
  }
};

export interface ComponentReconciliationRow {
  componentId: mongoose.Types.ObjectId;
  partCode: string;
  name: string;
  issuedQty: number;
  consumedQty: number;
  returnedQty: number;
  damagedQty: number;
  // "Expected outstanding" - derived from the stored, atomically-guarded
  // job counters. Normal and non-zero while the job is still in progress.
  remainingWithVendor: number;
  // Independent ledger cross-check: sums actual StockTransaction entries
  // referencing this job's documents and compares against the stored
  // counters. Should always be 0 - non-zero means the ledger and stored
  // balances disagree (data inconsistency, e.g. a pre-migration legacy
  // record), which is the genuinely "unexplained" signal, distinct from
  // ordinary outstanding vendor-held stock.
  ledgerDiscrepancy: number;
  isFullyReconciled: boolean;
}

export interface CircuitReconciliationRow {
  jobCircuitId: mongoose.Types.ObjectId | undefined;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  orderedQty: number;
  receivedGoodQty: number;
  receivedRejectedQty: number;
  remaining: number;
  isFullyAccounted: boolean;
}

export interface JobReconciliation {
  jobId: mongoose.Types.ObjectId;
  jobNumber: string;
  status: string;
  components: ComponentReconciliationRow[];
  circuits: CircuitReconciliationRow[];
  closeEligible: boolean;
}

// Computes the full per-component and per-circuit reconciliation for a job.
// Callable standalone (read-only GET, no session) or inside a transaction
// (e.g. from performJobClose, with a session so the close decision is made
// against the exact same in-transaction state it then commits against).
export async function computeJobReconciliation(job: IJob, session: ClientSession | null = null): Promise<JobReconciliation> {
  const [challans, receipts, jobReceipts] = await Promise.all([
    DeliveryChallan.find({ jobId: job._id }).select('challanNumber').session(session),
    MaterialReceipt.find({ jobId: job._id }).select('receiptNumber').session(session),
    JobReceipt.find({ jobId: job._id }).select('receiptNumber').session(session),
  ]);
  const allRefNos = [
    ...challans.map((c) => c.challanNumber),
    ...receipts.map((r) => r.receiptNumber),
    ...jobReceipts.map((r) => r.receiptNumber),
  ];

  const components: ComponentReconciliationRow[] = await Promise.all(
    job.materialRequirement.map(async (line) => {
      const ledgerEntries = await StockTransaction.find({
        componentId: line.componentId,
        referenceNo: { $in: allRefNos },
      }).session(session);

      let ledgerIssued = 0;
      let ledgerReturned = 0;
      let ledgerDamaged = 0;
      let ledgerConsumed = 0;
      for (const tx of ledgerEntries) {
        if (tx.type === 'ISSUE_TO_VENDOR') ledgerIssued += tx.qtyChange;
        else if (tx.type === 'RETURN_FROM_VENDOR') ledgerReturned += tx.qtyChange;
        else if (tx.type === 'CONSUMPTION' && tx.qtyChange < 0) ledgerDamaged += Math.abs(tx.qtyChange);
        else if (tx.type === 'CIRCUIT_CONSUMPTION') ledgerConsumed += Math.abs(tx.qtyChange);
      }

      const remainingWithVendor = Math.max(0, line.issuedQty - line.consumedQty - line.returnedQty - line.damagedQty);
      const ledgerRemaining = Math.max(0, ledgerIssued - ledgerConsumed - ledgerReturned - ledgerDamaged);
      const ledgerDiscrepancy = Number((remainingWithVendor - ledgerRemaining).toFixed(4));

      return {
        componentId: line.componentId,
        partCode: line.partCode,
        name: line.name,
        issuedQty: line.issuedQty,
        consumedQty: line.consumedQty,
        returnedQty: line.returnedQty,
        damagedQty: line.damagedQty,
        remainingWithVendor,
        ledgerDiscrepancy,
        isFullyReconciled: remainingWithVendor === 0 && ledgerDiscrepancy === 0,
      };
    })
  );

  const circuits: CircuitReconciliationRow[] = job.jobCircuits.map((jc) => ({
    jobCircuitId: jc._id,
    circuitCode: jc.circuitCode,
    circuitName: jc.circuitName,
    circuitVersion: jc.circuitVersion,
    orderedQty: jc.orderedQty,
    receivedGoodQty: jc.receivedGoodQty,
    receivedRejectedQty: jc.receivedRejectedQty,
    remaining: jc.orderedQty - jc.receivedGoodQty - jc.receivedRejectedQty,
    isFullyAccounted: jc.orderedQty === jc.receivedGoodQty + jc.receivedRejectedQty,
  }));

  const closeEligible = components.every((c) => c.isFullyReconciled) && circuits.every((c) => c.isFullyAccounted);

  return {
    jobId: job._id as mongoose.Types.ObjectId,
    jobNumber: job.jobNumber,
    status: job.status,
    components,
    circuits,
    closeEligible,
  };
}

export const getJobReconciliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }
    const reconciliation = await computeJobReconciliation(job);
    res.json({ data: reconciliation });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error computing job reconciliation' });
  }
};
