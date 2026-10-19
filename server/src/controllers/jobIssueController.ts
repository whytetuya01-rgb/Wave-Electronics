import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { Job } from '../models/Job.js';
import { Vendor } from '../models/Vendor.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { DeliveryChallan, IDeliveryChallanItem } from '../models/DeliveryChallan.js';
import { AuthRequest } from '../middleware/auth.js';
import { getNextSequence } from '../utils/sequence.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';
import { JobApprovalError } from '../utils/jobErrors.js';

// Generates auto formatted delivery challan number: CHL-YYYYMM-XXXX, same
// atomic counter pattern as job/inward numbers. Reuses the shared
// getNextSequence() helper - no separate counter system.
export async function generateChallanNumber(session?: ClientSession | null): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `CHL-${yearMonth}-`;
  const counterKey = `challan-${yearMonth}`;

  const seq = await getNextSequence(counterKey, {
    session,
    initFrom: async () => {
      const latestChallan = await DeliveryChallan.findOne({ challanNumber: { $regex: `^${prefix}` } })
        .sort({ challanNumber: -1 })
        .select('challanNumber')
        .session(session || null);

      if (!latestChallan?.challanNumber) return 0;
      const parts = latestChallan.challanNumber.split('-');
      const currentSeq = parts.length === 3 ? parseInt(parts[2], 10) : NaN;
      return isNaN(currentSeq) ? 0 : currentSeq;
    },
  });

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Thrown internally when a DeliveryChallan.create() hits the unique
// idempotencyKey index - signals the outer function to treat this request
// as an already-processed replay rather than an error. See
// performMaterialIssue for the full explanation.
class IdempotentReplayError extends Error {
  idempotencyKey: string;
  constructor(idempotencyKey: string) {
    super('Idempotent replay of an already-processed material issue');
    this.name = 'IdempotentReplayError';
    this.idempotencyKey = idempotencyKey;
  }
}

interface RawIssueItem {
  componentId: string;
  qty: number | string;
}

// Issues material against an Approved (or already Material Issued, for a
// subsequent partial issue) job: atomically moves stock store -> vendor for
// each requested component, records the issue against the job's own
// reservedQty/issuedQty accounting, writes an immutable ledger entry per
// component, and generates one Delivery Challan for the whole request.
//
// Like Approval, this uses a REAL transaction only (withRequiredTransaction)
// and is idempotent: a request replayed with the same idempotencyKey (retry,
// double-click, browser resend) never issues stock twice - it returns the
// already-created challan instead.
export async function performMaterialIssue(
  jobId: string,
  rawItems: RawIssueItem[],
  idempotencyKey: string,
  issuedById: mongoose.Types.ObjectId | string
) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new JobApprovalError('An idempotency key is required to issue material', 400);
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new JobApprovalError('At least one component line is required to issue material', 400);
  }

  // Fast path: this exact request already completed (sequential retry) -
  // short-circuit before even opening a transaction.
  const alreadyDone = await DeliveryChallan.findOne({ idempotencyKey });
  if (alreadyDone) {
    const job = await Job.findById(alreadyDone.jobId)
      .populate('vendorId', 'name city')
      .populate('approvedById', 'name email');
    return { challan: alreadyDone, job, alreadyProcessed: true };
  }

  // Validate and sanitize the request shape up front (no duplicate
  // components, positive quantities, valid references) before touching the DB.
  const seen = new Set<string>();
  const sanitizedItems: Array<{ componentId: mongoose.Types.ObjectId; qty: number }> = [];
  for (const raw of rawItems) {
    if (!raw.componentId || !mongoose.isValidObjectId(raw.componentId)) {
      throw new JobApprovalError('Every issue line must reference a valid component', 400);
    }
    if (seen.has(raw.componentId)) {
      throw new JobApprovalError(
        'Duplicate component in issue request - each component may only appear once per issue',
        400
      );
    }
    seen.add(raw.componentId);
    const qty = Number(raw.qty);
    if (!qty || qty <= 0) {
      throw new JobApprovalError('Issue quantity must be greater than zero for every line', 400);
    }
    sanitizedItems.push({ componentId: new mongoose.Types.ObjectId(raw.componentId), qty });
  }

  try {
    return await withRequiredTransaction(async (session) => {
      // Atomically claim eligibility: only Approved or already Material
      // Issued jobs qualify. This also flips Approved -> Material Issued on
      // the first issue; it's a no-op $set if already Material Issued.
      const claimedJob = await Job.findOneAndUpdate(
        { _id: jobId, status: { $in: ['approved', 'material_issued'] } },
        { $set: { status: 'material_issued' } },
        { new: false, session }
      );

      if (!claimedJob) {
        const existing = await Job.findById(jobId).session(session);
        if (!existing) throw new JobApprovalError('Job not found', 404);
        throw new JobApprovalError(
          `Job is '${existing.status}' and cannot receive a material issue. Only Approved or Material Issued jobs are eligible.`,
          400
        );
      }

      const vendor = await Vendor.findById(claimedJob.vendorId).session(session);
      if (!vendor) {
        throw new JobApprovalError('Vendor for this job no longer exists', 400);
      }

      // Pre-allocate the challan id and number so ledger entries created
      // during the per-item loop below can reference them directly, instead
      // of an awkward backfill after the challan document exists. Both
      // participate in this same transaction/session, so if anything later
      // fails and the transaction aborts, the number allocation rolls back
      // with it - no gaps are permanently consumed on failure.
      const challanId = new mongoose.Types.ObjectId();
      const challanNumber = await generateChallanNumber(session);

      const challanItems: IDeliveryChallanItem[] = [];

      for (const item of sanitizedItems) {
        const line = claimedJob.materialRequirement.find(
          (m) => m.componentId.toString() === item.componentId.toString()
        );
        if (!line) {
          throw new JobApprovalError('This component is not part of the job\'s material requirement', 400, {
            componentId: item.componentId.toString(),
          });
        }

        // Atomic stock movement: store -> vendor. Guarded on BOTH sufficient
        // physical stock and sufficient reservation at the moment the write
        // applies (not the moment we read it), closing the same lost-update
        // race the Day 2 and Approval fixes closed.
        const updatedComponent = await Component.findOneAndUpdate(
          {
            _id: item.componentId,
            $expr: {
              $and: [{ $gte: ['$inStoreStock', item.qty] }, { $gte: ['$reservedStock', item.qty] }],
            },
          },
          {
            $inc: { inStoreStock: -item.qty, reservedStock: -item.qty, withVendorStock: item.qty },
          },
          { new: true, session }
        );

        if (!updatedComponent) {
          const current = await Component.findById(item.componentId).session(session);
          throw new JobApprovalError(
            `Cannot issue ${item.qty} of '${line.partCode}': insufficient in-store or reserved stock (in-store=${current?.inStoreStock ?? 0}, reserved=${current?.reservedStock ?? 0})`,
            400,
            { componentId: item.componentId.toString(), partCode: line.partCode, requestedQty: item.qty }
          );
        }

        // Atomic job-line issuedQty increment, guarded against exceeding
        // this line's OWN remaining reservation. The $expr guard reaches
        // into the array (via $let/$filter/$arrayElemAt) so a non-matching
        // condition makes findOneAndUpdate reliably return null - a plain
        // arrayFilters update would NOT give us that reliable signal, since
        // it still "matches" the document even when zero array elements
        // satisfy the filter.
        const updatedJob = await Job.findOneAndUpdate(
          {
            _id: jobId,
            $expr: {
              $let: {
                vars: {
                  line: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$materialRequirement',
                          cond: { $eq: ['$$this.componentId', item.componentId] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $lte: [{ $add: ['$$line.issuedQty', item.qty] }, '$$line.reservedQty'] },
              },
            },
          },
          { $inc: { 'materialRequirement.$[elem].issuedQty': item.qty } },
          { arrayFilters: [{ 'elem.componentId': item.componentId }], session }
        );

        if (!updatedJob) {
          throw new JobApprovalError(
            `Cannot issue ${item.qty} of '${line.partCode}': exceeds remaining reserved quantity (reserved=${line.reservedQty}, already issued=${line.issuedQty})`,
            400,
            {
              componentId: item.componentId.toString(),
              partCode: line.partCode,
              remaining: line.reservedQty - line.issuedQty,
            }
          );
        }

        await StockTransaction.create(
          [
            {
              componentId: item.componentId,
              type: 'ISSUE_TO_VENDOR',
              locationType: 'VENDOR',
              vendorId: claimedJob.vendorId,
              qtyChange: item.qty,
              balanceInStoreAfter: updatedComponent.inStoreStock,
              balanceReservedAfter: updatedComponent.reservedStock,
              balanceWithVendorAfter: updatedComponent.withVendorStock,
              referenceType: 'CHALLAN',
              referenceId: challanId,
              referenceNo: challanNumber,
              notes: `Issued to ${vendor.name} for job ${claimedJob.jobNumber}`,
              createdById: issuedById,
            },
          ],
          { session }
        );

        challanItems.push({
          componentId: item.componentId,
          partCode: line.partCode,
          name: line.name,
          issuedQty: item.qty,
          receivedQty: 0,
          damagedQty: 0,
        });
      }

      let challan;
      try {
        const [created] = await DeliveryChallan.create(
          [
            {
              _id: challanId,
              challanNumber,
              challanDate: new Date(),
              jobId: claimedJob._id,
              jobNumber: claimedJob.jobNumber,
              vendorId: claimedJob.vendorId,
              vendorName: vendor.name,
              vendorAddress: vendor.address,
              vendorCity: vendor.city,
              vendorGstNumber: vendor.gstNumber,
              items: challanItems,
              totalItems: challanItems.length,
              totalQty: challanItems.reduce((sum, i) => sum + i.issuedQty, 0),
              status: 'issued',
              idempotencyKey,
              issuedById,
            },
          ],
          { session }
        );
        challan = created;
      } catch (err: any) {
        if (err.code === 11000) {
          // Lost a race to a concurrent request carrying the SAME
          // idempotency key - someone else already committed this exact
          // issue. Throwing here aborts and rolls back every stock movement
          // THIS transaction made above, leaving only the winner's
          // committed state. The outer catch below turns this into a
          // successful "already processed" response instead of an error.
          throw new IdempotentReplayError(idempotencyKey);
        }
        throw err;
      }

      const finalJob = await Job.findById(jobId)
        .populate('vendorId', 'name city')
        .populate('approvedById', 'name email')
        .session(session);

      return { challan, job: finalJob, alreadyProcessed: false };
    });
  } catch (error: any) {
    if (error instanceof IdempotentReplayError) {
      const existing = await DeliveryChallan.findOne({ idempotencyKey: error.idempotencyKey });
      if (existing) {
        const job = await Job.findById(existing.jobId)
          .populate('vendorId', 'name city')
          .populate('approvedById', 'name email');
        return { challan: existing, job, alreadyProcessed: true };
      }
    }
    throw error;
  }
}

export const issueMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, idempotencyKey } = req.body;
    const result = await performMaterialIssue(String(req.params.id), items, idempotencyKey, req.user!._id);
    const message = result.alreadyProcessed
      ? `Issue already processed as challan '${result.challan.challanNumber}' (duplicate request ignored)`
      : `Material issued - challan '${result.challan.challanNumber}' generated`;
    res.status(result.alreadyProcessed ? 200 : 201).json({ message, data: result });
  } catch (error: any) {
    if (error instanceof TransactionUnavailableError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof JobApprovalError) {
      res.status(error.status).json({ message: error.message, details: error.details });
      return;
    }
    res.status(500).json({ message: error.message || 'Error issuing material' });
  }
};
