import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { DeliveryChallan } from '../models/DeliveryChallan.js';
import { MaterialReceipt, IMaterialReceiptItem } from '../models/MaterialReceipt.js';
import { Job } from '../models/Job.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { getNextSequence } from '../utils/sequence.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';

// Carries an HTTP status and optional structured detail, mirroring
// JobApprovalError in jobController.ts for the same reason: precise
// responses without string-matching error messages.
export class ReceiptError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ReceiptError';
    this.status = status;
    this.details = details;
  }
}

// Thrown internally when a MaterialReceipt.create() hits the unique
// idempotencyKey index - mirrors IdempotentReplayError in jobController.ts.
class IdempotentReceiptReplayError extends Error {
  idempotencyKey: string;
  constructor(idempotencyKey: string) {
    super('Idempotent replay of an already-processed material receipt');
    this.name = 'IdempotentReceiptReplayError';
    this.idempotencyKey = idempotencyKey;
  }
}

// Generates auto formatted receipt number: RCP-YYYYMM-XXXX, same atomic
// counter pattern as job/inward/challan numbers.
export async function generateReceiptNumber(session?: ClientSession | null): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `RCP-${yearMonth}-`;
  const counterKey = `receipt-${yearMonth}`;

  const seq = await getNextSequence(counterKey, {
    session,
    initFrom: async () => {
      const latest = await MaterialReceipt.findOne({ receiptNumber: { $regex: `^${prefix}` } })
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

interface RawReceiptItem {
  componentId: string;
  receivedQty?: number | string;
  damagedQty?: number | string;
}

interface ApplyComponentReturnParams {
  session: ClientSession;
  challanId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  componentId: mongoose.Types.ObjectId;
  receivedQty: number;
  damagedQty: number;
  vendorName: string;
  vendorId: mongoose.Types.ObjectId;
  referenceNo: string;
  referenceId: mongoose.Types.ObjectId;
  referenceType: 'RECEIPT' | 'JOB_RECEIPT';
  receivedById: mongoose.Types.ObjectId | string;
}

interface ComponentReturnLineResult {
  componentId: mongoose.Types.ObjectId;
  partCode: string;
  name: string;
  issuedQty: number;
  previouslyReceivedQty: number;
  previouslyDamagedQty: number;
  receivedQty: number;
  damagedQty: number;
  remainingAfter: number;
}

// Applies ONE component-return line against a specific challan: atomic
// challan-line update (guarded against exceeding that line's remaining
// receivable), atomic component stock movement (withVendorStock -> store
// for receivedQty, write-off for damagedQty), atomic job-level counter
// update, and immutable ledger entries. Shared by BOTH the standalone
// challan-scoped receipt flow (performMaterialReceipt) and the combined
// job-scoped receipt flow (performJobReceipt in jobReceiptController.ts) -
// a single source of truth for the accounting logic, per the instruction
// to reuse this as an internal service rather than duplicate it.
export async function applyComponentReturnLine(
  params: ApplyComponentReturnParams
): Promise<ComponentReturnLineResult> {
  const {
    session,
    challanId,
    jobId,
    componentId,
    receivedQty,
    damagedQty,
    vendorName,
    vendorId,
    referenceNo,
    referenceId,
    referenceType,
    receivedById,
  } = params;
  const totalThisEvent = receivedQty + damagedQty;

  const challan = await DeliveryChallan.findById(challanId).session(session);
  if (!challan) throw new ReceiptError('Delivery challan not found', 404);

  const challanLine = challan.items.find((i) => i.componentId.toString() === componentId.toString());
  if (!challanLine) {
    throw new ReceiptError('This component is not part of this delivery challan', 400, {
      componentId: componentId.toString(),
    });
  }

  // Atomic challan-line update, guarded against exceeding the line's own
  // remaining receivable, evaluated against the document's state at the
  // moment the write applies - same $let/$filter/$arrayElemAt technique
  // used for Job.materialRequirement during Issue, for the same reason
  // (arrayFilters alone can't signal guard failure).
  const updatedChallan = await DeliveryChallan.findOneAndUpdate(
    {
      _id: challanId,
      $expr: {
        $let: {
          vars: {
            line: {
              $arrayElemAt: [{ $filter: { input: '$items', cond: { $eq: ['$$this.componentId', componentId] } } }, 0],
            },
          },
          in: { $lte: [{ $add: ['$$line.receivedQty', '$$line.damagedQty', totalThisEvent] }, '$$line.issuedQty'] },
        },
      },
    },
    { $inc: { 'items.$[elem].receivedQty': receivedQty, 'items.$[elem].damagedQty': damagedQty } },
    { arrayFilters: [{ 'elem.componentId': componentId }], session, new: true }
  );

  if (!updatedChallan) {
    const remaining = challanLine.issuedQty - challanLine.receivedQty - challanLine.damagedQty;
    throw new ReceiptError(
      `Cannot receive ${totalThisEvent} of '${challanLine.partCode}': exceeds remaining receivable quantity (remaining=${remaining})`,
      400,
      { componentId: componentId.toString(), partCode: challanLine.partCode, remaining }
    );
  }

  // Atomic stock movement: received qty -> store, received+damaged both
  // leave with-vendor stock. Single combined guard/update.
  const updatedComponent = await Component.findOneAndUpdate(
    { _id: componentId, $expr: { $gte: ['$withVendorStock', totalThisEvent] } },
    { $inc: { withVendorStock: -totalThisEvent, inStoreStock: receivedQty } },
    { new: true, session }
  );

  if (!updatedComponent) {
    const current = await Component.findById(componentId).session(session);
    throw new ReceiptError(
      `Cannot receive ${totalThisEvent} of '${challanLine.partCode}': exceeds component's with-vendor stock (with-vendor=${current?.withVendorStock ?? 0})`,
      400,
      { componentId: componentId.toString(), partCode: challanLine.partCode }
    );
  }

  // Job-level reconciliation counters. The challan-level guard above is the
  // actual correctness gate (can't over-return beyond what one document
  // said was issued); these are additive bookkeeping derived from an
  // already-validated event, so no extra race risk is introduced.
  await Job.updateOne(
    { _id: jobId },
    { $inc: { 'materialRequirement.$[elem].returnedQty': receivedQty, 'materialRequirement.$[elem].damagedQty': damagedQty } },
    { arrayFilters: [{ 'elem.componentId': componentId }], session }
  );

  if (receivedQty > 0) {
    await StockTransaction.create(
      [
        {
          componentId,
          type: 'RETURN_FROM_VENDOR',
          locationType: 'STORE',
          vendorId,
          qtyChange: receivedQty,
          balanceInStoreAfter: updatedComponent.inStoreStock,
          balanceReservedAfter: updatedComponent.reservedStock,
          balanceWithVendorAfter: updatedComponent.withVendorStock,
          referenceType,
          referenceId,
          referenceNo,
          notes: `Returned unused from ${vendorName} against challan ${challan.challanNumber}`,
          createdById: receivedById,
        },
      ],
      { session }
    );
  }

  if (damagedQty > 0) {
    await StockTransaction.create(
      [
        {
          componentId,
          type: 'CONSUMPTION',
          locationType: 'VENDOR',
          vendorId,
          qtyChange: -damagedQty,
          balanceInStoreAfter: updatedComponent.inStoreStock,
          balanceReservedAfter: updatedComponent.reservedStock,
          balanceWithVendorAfter: updatedComponent.withVendorStock,
          referenceType,
          referenceId,
          referenceNo,
          notes: `Reported damaged/lost at ${vendorName} against challan ${challan.challanNumber}`,
          createdById: receivedById,
        },
      ],
      { session }
    );
  }

  const updatedChallanLine = updatedChallan.items.find((i) => i.componentId.toString() === componentId.toString())!;

  return {
    componentId,
    partCode: challanLine.partCode,
    name: challanLine.name,
    issuedQty: challanLine.issuedQty,
    previouslyReceivedQty: challanLine.receivedQty,
    previouslyDamagedQty: challanLine.damagedQty,
    receivedQty,
    damagedQty,
    remainingAfter: updatedChallanLine.issuedQty - updatedChallanLine.receivedQty - updatedChallanLine.damagedQty,
  };
}

// Recomputes and persists a challan's overall status after a receipt event
// touched it. Shared by both receipt flows.
export async function refreshChallanStatus(challanId: mongoose.Types.ObjectId, session: ClientSession) {
  const refreshedChallan = await DeliveryChallan.findById(challanId).session(session);
  if (!refreshedChallan) return null;
  const fullyReceived = refreshedChallan.items.every((i) => i.receivedQty + i.damagedQty >= i.issuedQty);
  refreshedChallan.status = fullyReceived ? 'received' : 'partially_received';
  await refreshedChallan.save({ session });
  return refreshedChallan;
}

// Records a material receipt event against a specific delivery challan:
// validates and atomically applies receivedQty (-> store) and damagedQty
// (write-off) per component line, guarded against exceeding BOTH the
// challan line's own remaining receivable and the component's actual
// with-vendor stock. Real transaction only (withRequiredTransaction) and
// idempotent on a client-supplied key, exactly mirroring
// performMaterialIssue's design.
export async function performMaterialReceipt(
  challanId: string,
  rawItems: RawReceiptItem[],
  idempotencyKey: string,
  receivedById: mongoose.Types.ObjectId | string,
  notes?: string
) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new ReceiptError('An idempotency key is required to record a material receipt', 400);
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ReceiptError('At least one component line is required to record a receipt', 400);
  }

  // Fast path: this exact request already completed (sequential retry).
  const alreadyDone = await MaterialReceipt.findOne({ idempotencyKey });
  if (alreadyDone) {
    const challan = await DeliveryChallan.findById(alreadyDone.challanId);
    return { receipt: alreadyDone, challan, alreadyProcessed: true };
  }

  const seen = new Set<string>();
  const sanitizedItems: Array<{ componentId: mongoose.Types.ObjectId; receivedQty: number; damagedQty: number }> = [];
  for (const raw of rawItems) {
    if (!raw.componentId || !mongoose.isValidObjectId(raw.componentId)) {
      throw new ReceiptError('Every receipt line must reference a valid component', 400);
    }
    if (seen.has(raw.componentId)) {
      throw new ReceiptError(
        'Duplicate component in receipt request - each component may only appear once per receipt',
        400
      );
    }
    seen.add(raw.componentId);
    const receivedQty = Number(raw.receivedQty) || 0;
    const damagedQty = Number(raw.damagedQty) || 0;
    if (receivedQty < 0 || damagedQty < 0) {
      throw new ReceiptError('Received and damaged quantities cannot be negative', 400);
    }
    if (receivedQty === 0 && damagedQty === 0) {
      throw new ReceiptError('Every receipt line needs a received or damaged quantity greater than zero', 400);
    }
    sanitizedItems.push({ componentId: new mongoose.Types.ObjectId(raw.componentId), receivedQty, damagedQty });
  }

  try {
    return await withRequiredTransaction(async (session) => {
      const challan = await DeliveryChallan.findById(challanId).session(session);
      if (!challan) throw new ReceiptError('Delivery challan not found', 404);

      const eligibleJob = await Job.findOne({
        _id: challan.jobId,
        status: { $in: ['material_issued', 'partially_received'] },
      }).session(session);
      if (!eligibleJob) {
        const existingJob = await Job.findById(challan.jobId).session(session);
        throw new ReceiptError(
          `Job is '${existingJob?.status}' and cannot receive material against this challan. Only Material Issued or Partially Received jobs are eligible.`,
          400
        );
      }

      const receiptNumber = await generateReceiptNumber(session);
      const receiptItems: IMaterialReceiptItem[] = [];
      // The MaterialReceipt document itself is created after this loop and
      // gets its own _id then - referenceId for ledger entries is attached
      // via a pre-generated id so entries can be created inline in the loop.
      const receiptId = new mongoose.Types.ObjectId();

      for (const item of sanitizedItems) {
        const lineResult = await applyComponentReturnLine({
          session,
          challanId: challan._id,
          jobId: challan.jobId,
          componentId: item.componentId,
          receivedQty: item.receivedQty,
          damagedQty: item.damagedQty,
          vendorName: challan.vendorName,
          vendorId: challan.vendorId,
          referenceNo: receiptNumber,
          referenceId: receiptId,
          referenceType: 'RECEIPT',
          receivedById,
        });
        receiptItems.push(lineResult as IMaterialReceiptItem);
      }

      const refreshedChallan = await refreshChallanStatus(challan._id, session);

      // First receipt against ANY challan on this job flips it to Partially
      // Received, matching the spec's literal status flow. This never
      // auto-closes the job - Job Closing is a separate, out-of-scope
      // workflow requiring its own explicit business decision.
      if (eligibleJob.status !== 'partially_received') {
        eligibleJob.status = 'partially_received';
        await eligibleJob.save({ session });
      }

      let receipt;
      try {
        const [created] = await MaterialReceipt.create(
          [
            {
              _id: receiptId,
              receiptNumber,
              receiptDate: new Date(),
              challanId: challan._id,
              challanNumber: challan.challanNumber,
              jobId: challan.jobId,
              jobNumber: challan.jobNumber,
              vendorId: challan.vendorId,
              items: receiptItems,
              totalItems: receiptItems.length,
              totalReceivedQty: receiptItems.reduce((sum, i) => sum + i.receivedQty, 0),
              totalDamagedQty: receiptItems.reduce((sum, i) => sum + i.damagedQty, 0),
              notes: notes?.trim(),
              idempotencyKey,
              receivedById,
            },
          ],
          { session }
        );
        receipt = created;
      } catch (err: any) {
        if (err.code === 11000) {
          // Lost a race to a concurrent request carrying the SAME
          // idempotency key. Throwing here aborts and rolls back every
          // stock/challan/job change THIS transaction made above.
          throw new IdempotentReceiptReplayError(idempotencyKey);
        }
        throw err;
      }

      return { receipt, challan: refreshedChallan, alreadyProcessed: false };
    });
  } catch (error: any) {
    if (error instanceof IdempotentReceiptReplayError) {
      const existing = await MaterialReceipt.findOne({ idempotencyKey: error.idempotencyKey });
      if (existing) {
        const challan = await DeliveryChallan.findById(existing.challanId);
        return { receipt: existing, challan, alreadyProcessed: true };
      }
    }
    throw error;
  }
}

export const receiveMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, idempotencyKey, notes } = req.body;
    const result = await performMaterialReceipt(String(req.params.id), items, idempotencyKey, req.user!._id, notes);
    const message = result.alreadyProcessed
      ? `Receipt already processed as '${result.receipt.receiptNumber}' (duplicate request ignored)`
      : `Material receipt '${result.receipt.receiptNumber}' recorded`;
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
    res.status(500).json({ message: error.message || 'Error recording material receipt' });
  }
};

export const getReceiptsByChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receipts = await MaterialReceipt.find({ challanId: req.params.challanId })
      .populate('receivedById', 'name email')
      .sort({ createdAt: -1 });
    res.json({ data: receipts });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching material receipts' });
  }
};

export const getReceiptsByJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receipts = await MaterialReceipt.find({ jobId: req.params.jobId })
      .populate('receivedById', 'name email')
      .sort({ createdAt: -1 });
    res.json({ data: receipts });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching material receipts' });
  }
};
