import { Response } from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { AuthRequest } from '../middleware/auth.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';
import { JobApprovalError } from '../utils/jobErrors.js';

// Closes a job (normal or admin short-close). Normal close requires every
// circuit's ordered quantity to be fully accounted for (good+rejected) and
// every component's material to be fully reconciled (zero remaining with
// vendor, zero ledger discrepancy) - computed via the SAME
// computeJobReconciliation() the reconciliation endpoint uses, so "can this
// close" and "what does the reconciliation report show" can never disagree.
// Short-close bypasses the completeness requirement but requires an admin-
// supplied reason and permanently snapshots the reconciliation state at
// close time, exactly as it stood - it never adjusts stock. Closed jobs
// become read-only everywhere else (Approval/Issue/Receipt/Edit guards).
export async function performJobClose(
  jobId: string,
  closedById: mongoose.Types.ObjectId | string,
  options: { shortClose?: boolean; reason?: string } = {}
) {
  // Dynamic import (not a static one) to avoid a circular import: this
  // module lives in the job-controller family that jobReceiptController.ts
  // does NOT import from, and this keeps it that way in both directions.
  const { computeJobReconciliation } = await import('./jobReceiptController.js');

  return withRequiredTransaction(async (session) => {
    const job = await Job.findOne({ _id: jobId, status: { $in: ['material_issued', 'partially_received'] } }).session(
      session
    );
    if (!job) {
      const existing = await Job.findById(jobId).session(session);
      if (!existing) throw new JobApprovalError('Job not found', 404);
      throw new JobApprovalError(
        `Job is '${existing.status}' and cannot be closed. Only Material Issued or Partially Received jobs are eligible.`,
        400
      );
    }

    const reconciliation = await computeJobReconciliation(job, session);

    if (!options.shortClose) {
      if (!reconciliation.closeEligible) {
        throw new JobApprovalError(
          'Cannot close job: outstanding circuit quantities or unreconciled material remain. Use short-close with a reason, or complete reconciliation first.',
          400,
          { reconciliation: reconciliation as unknown as Record<string, unknown> }
        );
      }
    } else {
      if (!options.reason || !options.reason.trim()) {
        throw new JobApprovalError('A reason is required to short-close a job with outstanding quantities or material', 400);
      }
    }

    const updated = await Job.findOneAndUpdate(
      { _id: jobId, status: { $in: ['material_issued', 'partially_received'] } },
      {
        $set: {
          status: 'closed',
          closedById,
          closedAt: new Date(),
          isShortClosed: Boolean(options.shortClose),
          closeReason: options.shortClose ? options.reason!.trim() : undefined,
          closeReconciliationSnapshot: reconciliation,
        },
      },
      { new: true, session }
    );

    if (!updated) {
      throw new JobApprovalError('Job status changed concurrently - cannot close', 409);
    }

    return { job: updated, reconciliation };
  });
}

export const closeJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shortClose, reason } = req.body;
    const result = await performJobClose(String(req.params.id), req.user!._id, { shortClose: Boolean(shortClose), reason });
    res.json({
      message: result.job.isShortClosed ? `Job '${result.job.jobNumber}' short-closed` : `Job '${result.job.jobNumber}' closed`,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof TransactionUnavailableError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof JobApprovalError) {
      res.status(error.status).json({ message: error.message, details: error.details });
      return;
    }
    res.status(500).json({ message: error.message || 'Error closing job' });
  }
};

// Reopening a closed job (UC-21) is deliberately NOT implemented in this
// phase. It requires safe correction semantics, full history preservation,
// its own permission model, and audit logging - none of which have been
// defined and approved yet. A closed job is simply permanently read-only
// for now; reopening is explicitly deferred to a future, separately
// reviewed change rather than guessed at here.
