import { Response } from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Vendor } from '../models/Vendor.js';
import { Circuit } from '../models/Circuit.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';
import { JobApprovalError } from '../utils/jobErrors.js';

export { JobApprovalError };

// Statuses that mean a circuit version is still "in use" by a job and must
// stay locked. Draft jobs are excluded on purpose - a draft never locked the
// circuit in the first place (only Approval does), so a draft alone should
// never keep a circuit locked after an approved job referencing it cancels.
const CIRCUIT_LOCKING_JOB_STATUSES = ['approved', 'material_issued', 'partially_received', 'closed'];

// Approves a Draft job: validates vendor/component/stock state against the
// job's own historical requirement snapshot, then atomically reserves every
// required component. Uses a REAL MongoDB transaction only - see
// withRequiredTransaction for why no non-transactional fallback exists here.
// Exported as a plain function (not just the Express handler below) so it
// can be exercised directly in tests without an HTTP layer, matching how
// buildJobCircuitsAndRequirement is tested elsewhere.
export async function performJobApproval(jobId: string, approvedById: mongoose.Types.ObjectId | string) {
  return withRequiredTransaction(async (session) => {
      // Atomically claim the job for approval. This conditional update IS
      // the guard against double approval and concurrent approval races:
      // if another request already flipped the status, this matches
      // nothing and we abort before touching any component. `new: false`
      // returns the pre-update document so we still have the original
      // materialRequirement/vendorId/jobCircuits to work with below.
      const claimedJob = await Job.findOneAndUpdate(
        { _id: jobId, status: 'draft' },
        { $set: { status: 'approved', approvedById, approvedAt: new Date() } },
        { new: false, session }
      );

      if (!claimedJob) {
        const existing = await Job.findById(jobId).session(session);
        if (!existing) throw new JobApprovalError('Job not found', 404);
        throw new JobApprovalError(
          `Job is '${existing.status}' and cannot be approved. Only Draft jobs can be approved, and only once.`,
          400
        );
      }

      // Vendor must still be active at approval time (it may have been
      // deactivated after the draft was created).
      const vendor = await Vendor.findById(claimedJob.vendorId).session(session);
      if (!vendor || !vendor.isActive) {
        throw new JobApprovalError(
          `Vendor is inactive or no longer exists - approval blocked. Edit the job to a different vendor first.`,
          400
        );
      }

      // Every required component must still exist and be active.
      const componentIds = claimedJob.materialRequirement.map((m) => m.componentId);
      const components = await Component.find({ _id: { $in: componentIds } }).session(session);
      const componentById = new Map(components.map((c) => [c._id.toString(), c]));

      for (const line of claimedJob.materialRequirement) {
        const comp = componentById.get(line.componentId.toString());
        if (!comp) {
          throw new JobApprovalError(
            `Component '${line.partCode}' no longer exists - approval blocked`,
            400,
            { componentId: line.componentId.toString(), partCode: line.partCode }
          );
        }
        if (!comp.isActive) {
          throw new JobApprovalError(
            `Component '${line.partCode}' is inactive - approval blocked`,
            400,
            { componentId: line.componentId.toString(), partCode: line.partCode }
          );
        }
      }

      // Reserve every required component atomically. Each update is
      // conditional on sufficient available stock being present AT THE
      // MOMENT the write applies (not the moment we read it above), closing
      // the same lost-update race the Day 2 stock fixes closed. If any one
      // line can't be reserved, we throw - aborting the WHOLE transaction,
      // including every reservation already applied in this same job
      // approval and the status flip itself. No partial reservation.
      for (const line of claimedJob.materialRequirement) {
        const updated = await Component.findOneAndUpdate(
          {
            _id: line.componentId,
            $expr: { $gte: ['$inStoreStock', { $add: ['$reservedStock', line.requiredQty] }] },
          },
          { $inc: { reservedStock: line.requiredQty } },
          { new: true, session }
        );

        if (!updated) {
          const comp = componentById.get(line.componentId.toString())!;
          const available = Math.max(0, comp.inStoreStock - comp.reservedStock);
          const shortageQty = Number((line.requiredQty - available).toFixed(4));
          throw new JobApprovalError(
            `Insufficient stock for '${line.partCode}': required ${line.requiredQty}, available ${available}`,
            400,
            { componentId: line.componentId.toString(), partCode: line.partCode, required: line.requiredQty, available, shortageQty }
          );
        }

        // Audit-trail ledger entry for the reservation itself. qtyChange is
        // deliberately 0 - reserving stock does not physically move it
        // (inStoreStock/withVendorStock are unchanged, only reservedStock
        // moves), so this entry is correctly excluded from every existing
        // physical stock-balance calculation that sums qtyChange (e.g. the
        // inStoreStock === sum(ledger qtyChange) invariant). It exists purely
        // so "who reserved what, when, against which job" is reconstructable
        // from the ledger instead of being invisible between Approval and
        // Issue/Cancellation.
        await StockTransaction.create(
          [
            {
              componentId: line.componentId,
              type: 'RESERVE',
              locationType: 'STORE',
              qtyChange: 0,
              balanceInStoreAfter: updated.inStoreStock,
              balanceReservedAfter: updated.reservedStock,
              balanceWithVendorAfter: updated.withVendorStock,
              referenceType: 'JOB',
              referenceId: claimedJob._id,
              referenceNo: claimedJob.jobNumber,
              notes: `Reserved for job ${claimedJob.jobNumber} on approval`,
              createdById: approvedById,
            },
          ],
          { session }
        );
      }

      // Record the reservation against each requirement line.
      const reservedMaterialRequirement = claimedJob.materialRequirement.map((m) => ({
        componentId: m.componentId,
        partCode: m.partCode,
        name: m.name,
        requiredQty: m.requiredQty,
        unitRate: m.unitRate,
        totalCost: m.totalCost,
        reservedQty: m.requiredQty,
        issuedQty: m.issuedQty,
      }));

      // Lock every referenced circuit version so its BOM can't be edited
      // out from under this now-approved job.
      const circuitIds = claimedJob.jobCircuits.map((jc) => jc.circuitId);

      const [finalJob] = await Promise.all([
        Job.findByIdAndUpdate(
          jobId,
          { $set: { materialRequirement: reservedMaterialRequirement } },
          { new: true, session }
        )
          .populate('vendorId', 'name city')
          .populate('approvedById', 'name email'),
        Circuit.updateMany({ _id: { $in: circuitIds } }, { $set: { isLocked: true } }, { session }),
      ]);

      return finalJob;
    });
}

export const approveJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const approvedJob = await performJobApproval(String(req.params.id), req.user!._id);
    res.json({ message: `Job '${approvedJob!.jobNumber}' approved and material reserved`, data: approvedJob });
  } catch (error: any) {
    if (error instanceof TransactionUnavailableError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof JobApprovalError) {
      res.status(error.status).json({ message: error.message, details: error.details });
      return;
    }
    res.status(500).json({ message: error.message || 'Error approving job' });
  }
};

// Cancels a Draft or Approved job. Draft cancellation never touched
// inventory so it's a plain single-document write; Approved cancellation
// must release every reservation atomically, so it uses the same required-
// transaction pattern as approval. Exported as a plain function for the
// same testability reason as performJobApproval.
export async function performJobCancellation(jobId: string, cancelledById: mongoose.Types.ObjectId | string) {
  const existing = await Job.findById(jobId);
  if (!existing) {
    throw new JobApprovalError('Job not found', 404);
  }

  if (existing.status === 'draft') {
    existing.status = 'cancelled';
    existing.cancelledById = cancelledById as any;
    existing.cancelledAt = new Date();
    await existing.save();
    return existing;
  }

  if (existing.status !== 'approved') {
    throw new JobApprovalError(
      `Job is '${existing.status}' and cannot be cancelled this way. Jobs with material issued cannot be cancelled.`,
      400
    );
  }

  return withRequiredTransaction(async (session) => {
      const claimedJob = await Job.findOneAndUpdate(
        { _id: jobId, status: 'approved' },
        { $set: { status: 'cancelled', cancelledById, cancelledAt: new Date() } },
        { new: false, session }
      );

      if (!claimedJob) {
        // Lost a race with a concurrent approve/cancel/issue - re-check and
        // report the real current state rather than silently doing nothing.
        const current = await Job.findById(jobId).session(session);
        throw new JobApprovalError(
          `Job is '${current?.status}' and cannot be cancelled this way.`,
          400
        );
      }

      // Release every reservation atomically, conditional on enough
      // reserved stock actually being present (defends against the
      // reservation having already been partially consumed by some other
      // path, rather than blindly subtracting).
      for (const line of claimedJob.materialRequirement) {
        if (line.reservedQty <= 0) continue;
        const released = await Component.findOneAndUpdate(
          { _id: line.componentId, reservedStock: { $gte: line.reservedQty } },
          { $inc: { reservedStock: -line.reservedQty } },
          { new: true, session }
        );
        if (!released) {
          throw new JobApprovalError(
            `Failed to release reservation for component '${line.partCode}' - reserved stock inconsistent`,
            500
          );
        }

        // Mirrors the RESERVE entry written at approval time - same
        // qtyChange=0 rationale (releasing a reservation doesn't physically
        // move stock either), kept purely for audit visibility.
        await StockTransaction.create(
          [
            {
              componentId: line.componentId,
              type: 'UNRESERVE',
              locationType: 'STORE',
              qtyChange: 0,
              balanceInStoreAfter: released.inStoreStock,
              balanceReservedAfter: released.reservedStock,
              balanceWithVendorAfter: released.withVendorStock,
              referenceType: 'JOB',
              referenceId: claimedJob._id,
              referenceNo: claimedJob.jobNumber,
              notes: `Reservation released for job ${claimedJob.jobNumber} on cancellation`,
              createdById: cancelledById,
            },
          ],
          { session }
        );
      }

      const releasedMaterialRequirement = claimedJob.materialRequirement.map((m) => ({
        componentId: m.componentId,
        partCode: m.partCode,
        name: m.name,
        requiredQty: m.requiredQty,
        unitRate: m.unitRate,
        totalCost: m.totalCost,
        reservedQty: 0,
        issuedQty: m.issuedQty,
      }));

      // Unlock each referenced circuit version, UNLESS another approved or
      // historical job still requires it.
      const circuitIds = claimedJob.jobCircuits.map((jc) => jc.circuitId);
      for (const circuitId of circuitIds) {
        const stillReferenced = await Job.exists({
          _id: { $ne: jobId },
          'jobCircuits.circuitId': circuitId,
          status: { $in: CIRCUIT_LOCKING_JOB_STATUSES },
        }).session(session);
        if (!stillReferenced) {
          await Circuit.findByIdAndUpdate(circuitId, { $set: { isLocked: false } }, { session });
        }
      }

      return Job.findByIdAndUpdate(
        jobId,
        { $set: { materialRequirement: releasedMaterialRequirement } },
        { new: true, session }
      );
  });
}

export const cancelJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cancelledJob = await performJobCancellation(String(req.params.id), req.user!._id);
    const releasedNote = cancelledJob!.status === 'cancelled' ? ' and reservations released' : '';
    res.json({ message: `Job '${cancelledJob!.jobNumber}' cancelled${releasedNote}`, data: cancelledJob });
  } catch (error: any) {
    if (error instanceof TransactionUnavailableError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof JobApprovalError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: error.message || 'Error cancelling job' });
  }
};
