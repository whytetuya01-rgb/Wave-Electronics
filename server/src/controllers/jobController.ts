import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { Job, IJobCircuit, IJobMaterialRequirement } from '../models/Job.js';
import { Vendor } from '../models/Vendor.js';
import { Circuit } from '../models/Circuit.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { DeliveryChallan, IDeliveryChallanItem } from '../models/DeliveryChallan.js';
import { AuthRequest } from '../middleware/auth.js';
import { getNextSequence } from '../utils/sequence.js';
import { withRequiredTransaction, TransactionUnavailableError } from '../utils/transaction.js';

interface RawJobCircuit {
  circuitId: string;
  orderedQty: number | string;
}

// Statuses that mean a circuit version is still "in use" by a job and must
// stay locked. Draft jobs are excluded on purpose - a draft never locked the
// circuit in the first place (only Approval does), so a draft alone should
// never keep a circuit locked after an approved job referencing it cancels.
const CIRCUIT_LOCKING_JOB_STATUSES = ['approved', 'material_issued', 'partially_received', 'closed'];

// Carries an HTTP status and optional structured detail (e.g. which
// component was short) so the route handler can return a precise response
// without string-matching error messages.
export class JobApprovalError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'JobApprovalError';
    this.status = status;
    this.details = details;
  }
}

// Generates auto formatted job number: JOB-YYYYMM-XXXX using the same atomic
// per-month counter pattern as stock inward numbers.
export async function generateJobNumber(session?: ClientSession | null): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `JOB-${yearMonth}-`;
  const counterKey = `job-${yearMonth}`;

  const seq = await getNextSequence(counterKey, {
    session,
    initFrom: async () => {
      const latestJob = await Job.findOne({ jobNumber: { $regex: `^${prefix}` } })
        .sort({ jobNumber: -1 })
        .select('jobNumber')
        .session(session || null);

      if (!latestJob?.jobNumber) return 0;
      const parts = latestJob.jobNumber.split('-');
      const currentSeq = parts.length === 3 ? parseInt(parts[2], 10) : NaN;
      return isNaN(currentSeq) ? 0 : currentSeq;
    },
  });

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

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

// Validates a vendor reference is well-formed, exists, and is active.
// Shared by create and edit so both paths enforce the same rule the same
// way (and so it can be exercised directly in tests without an HTTP layer).
export async function assertVendorActiveForJob(vendorId: string) {
  if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
    throw new Error('A valid vendor is required');
  }
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw new Error('Selected vendor does not exist');
  }
  if (!vendor.isActive) {
    throw new Error(`Vendor '${vendor.name}' is inactive and cannot be assigned a job`);
  }
  return vendor;
}

// Validates the selected circuits (no duplicates, positive quantities, must
// be active), then builds the immutable per-circuit BOM snapshot and the
// aggregated cross-circuit material requirement - all from LIVE circuit/
// component data at the moment of this call. Read-only: never touches stock.
export async function buildJobCircuitsAndRequirement(rawJobCircuits: RawJobCircuit[]): Promise<{
  jobCircuits: IJobCircuit[];
  materialRequirement: IJobMaterialRequirement[];
  totalEstimatedCost: number;
}> {
  if (!Array.isArray(rawJobCircuits) || rawJobCircuits.length === 0) {
    throw new Error('At least one circuit is required for a job');
  }

  const seen = new Set<string>();
  for (const row of rawJobCircuits) {
    if (!row.circuitId || !mongoose.isValidObjectId(row.circuitId)) {
      throw new Error('Every job circuit row must reference a valid circuit');
    }
    if (seen.has(row.circuitId)) {
      throw new Error('Duplicate circuit selection: a job cannot include the same circuit version twice');
    }
    seen.add(row.circuitId);

    const qty = Number(row.orderedQty);
    if (!qty || qty <= 0) {
      throw new Error('Ordered quantity must be greater than zero for every selected circuit');
    }
  }

  const circuitIds = rawJobCircuits.map((r) => r.circuitId);
  const circuits = await Circuit.find({ _id: { $in: circuitIds } });
  const circuitById = new Map(circuits.map((c) => [c._id.toString(), c]));

  for (const row of rawJobCircuits) {
    const circuit = circuitById.get(row.circuitId);
    if (!circuit) {
      throw new Error(`Circuit ${row.circuitId} does not exist`);
    }
    if (circuit.status !== 'active') {
      throw new Error(`Circuit '${circuit.circuitCode}' v${circuit.version} is inactive and cannot be used in a new job`);
    }
  }

  const allComponentIds = new Set<string>();
  for (const circuit of circuitById.values()) {
    for (const item of circuit.bomItems) allComponentIds.add(item.componentId.toString());
  }
  const components = await Component.find({ _id: { $in: Array.from(allComponentIds) } });
  const componentById = new Map(components.map((c) => [c._id.toString(), c]));

  const jobCircuits: IJobCircuit[] = [];
  const requirementMap = new Map<string, { partCode: string; name: string; requiredQty: number; unitRate: number }>();

  for (const row of rawJobCircuits) {
    const circuit = circuitById.get(row.circuitId)!;
    const orderedQty = Number(row.orderedQty);

    const bomSnapshot = circuit.bomItems.map((item) => {
      const component = componentById.get(item.componentId.toString());
      if (!component) {
        throw new Error(`A component referenced by circuit '${circuit.circuitCode}' BOM no longer exists`);
      }
      return {
        componentId: component._id,
        partCode: component.partCode,
        name: component.name,
        qtyPerUnit: item.qtyPerUnit,
        unitRate: component.ratePerUnit,
        designator: item.designator,
      };
    });

    const perUnitCost = bomSnapshot.reduce((sum, b) => sum + b.qtyPerUnit * b.unitRate, 0);
    const estimatedMaterialCost = Number((perUnitCost * orderedQty).toFixed(2));

    jobCircuits.push({
      circuitId: circuit._id,
      circuitCode: circuit.circuitCode,
      circuitName: circuit.name,
      circuitVersion: circuit.version,
      orderedQty,
      bomSnapshot,
      estimatedMaterialCost,
    } as IJobCircuit);

    for (const b of bomSnapshot) {
      const requiredQty = b.qtyPerUnit * orderedQty;
      const key = b.componentId.toString();
      if (requirementMap.has(key)) {
        requirementMap.get(key)!.requiredQty += requiredQty;
      } else {
        requirementMap.set(key, { partCode: b.partCode, name: b.name, requiredQty, unitRate: b.unitRate });
      }
    }
  }

  const materialRequirement: IJobMaterialRequirement[] = Array.from(requirementMap.entries()).map(
    ([componentId, r]) =>
      ({
        componentId: new mongoose.Types.ObjectId(componentId),
        partCode: r.partCode,
        name: r.name,
        requiredQty: Number(r.requiredQty.toFixed(4)),
        unitRate: r.unitRate,
        totalCost: Number((r.requiredQty * r.unitRate).toFixed(2)),
        reservedQty: 0,
        issuedQty: 0,
      } as IJobMaterialRequirement)
  );

  const totalEstimatedCost = Number(jobCircuits.reduce((sum, jc) => sum + jc.estimatedMaterialCost, 0).toFixed(2));

  return { jobCircuits, materialRequirement, totalEstimatedCost };
}

// Joins a job's frozen material requirement snapshot with LIVE component
// stock to compute availability/shortage. Never persisted - always computed
// fresh, since shortage must reflect real-time stock, unlike the cost
// snapshot which stays frozen for historical accuracy.
export async function attachLiveAvailability(materialRequirement: IJobMaterialRequirement[]) {
  if (!materialRequirement || materialRequirement.length === 0) return [];
  const componentIds = materialRequirement.map((m) => m.componentId);
  const components = await Component.find({ _id: { $in: componentIds } });
  const componentById = new Map(components.map((c) => [c._id.toString(), c]));

  return materialRequirement.map((m) => {
    const component = componentById.get(m.componentId.toString());
    const inStoreStock = component?.inStoreStock || 0;
    const reservedStock = component?.reservedStock || 0;
    // Vendor-held stock is deliberately excluded from availability.
    const availableStock = Math.max(0, inStoreStock - reservedStock);
    const shortageQty = Math.max(0, Number((m.requiredQty - availableStock).toFixed(4)));
    // Built from named fields rather than `...m` spread: `m` may be a
    // hydrated Mongoose subdocument (e.g. when called with an in-memory
    // Job document rather than a `.lean()` result), and spreading one
    // silently drops its schema-path fields instead of copying them.
    return {
      componentId: m.componentId,
      partCode: m.partCode,
      name: m.name,
      requiredQty: m.requiredQty,
      unitRate: m.unitRate,
      totalCost: m.totalCost,
      reservedQty: m.reservedQty,
      issuedQty: m.issuedQty,
      inStoreStock,
      reservedStock,
      availableStock,
      shortageQty,
      hasShortage: shortageQty > 0,
    };
  });
}

export const getJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, vendorId, page = 1, limit = 25 } = req.query;
    const query: any = {};

    if (search) {
      query.jobNumber = { $regex: search as string, $options: 'i' };
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (vendorId) {
      query.vendorId = vendorId;
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('vendorId', 'name city')
        .populate('createdById', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(query),
    ]);

    // Batch-fetch every component referenced across this page of jobs once,
    // instead of querying per job, to flag shortage without an N+1 pattern.
    const allComponentIds = new Set<string>();
    jobs.forEach((j: any) => j.materialRequirement.forEach((m: any) => allComponentIds.add(m.componentId.toString())));
    const components = await Component.find({ _id: { $in: Array.from(allComponentIds) } }).select(
      'inStoreStock reservedStock'
    );
    const componentById = new Map(components.map((c) => [c._id.toString(), c]));

    const enriched = jobs.map((job: any) => {
      const hasShortage = job.materialRequirement.some((m: any) => {
        const c = componentById.get(m.componentId.toString());
        const available = Math.max(0, (c?.inStoreStock || 0) - (c?.reservedStock || 0));
        return m.requiredQty > available;
      });
      return {
        ...job,
        circuitCount: job.jobCircuits.length,
        totalOrderedQty: job.jobCircuits.reduce((sum: number, jc: any) => sum + jc.orderedQty, 0),
        hasShortage,
      };
    });

    res.json({
      data: enriched,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching jobs' });
  }
};

export const getJobById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('vendorId', 'name contactPerson phone city isActive')
      .populate('createdById', 'name email')
      .populate('updatedById', 'name email')
      .populate('approvedById', 'name email')
      .populate('cancelledById', 'name email')
      .lean();

    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    const materialRequirementWithAvailability = await attachLiveAvailability(job.materialRequirement as any);

    res.json({
      data: {
        ...job,
        materialRequirement: materialRequirementWithAvailability,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching job details' });
  }
};

export const createJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorId, targetDate, remarks, jobCircuits } = req.body;

    if (!targetDate) {
      res.status(400).json({ message: 'Target completion date is required' });
      return;
    }

    try {
      await assertVendorActiveForJob(vendorId);
    } catch (vendorError: any) {
      res.status(400).json({ message: vendorError.message });
      return;
    }

    let built;
    try {
      built = await buildJobCircuitsAndRequirement(jobCircuits);
    } catch (buildError: any) {
      res.status(400).json({ message: buildError.message });
      return;
    }

    const jobNumber = await generateJobNumber();

    // Draft creation never touches component stock - only reads BOM/rate
    // data to build the immutable snapshot. Reservation happens at Approval
    // (not implemented yet).
    const job = await Job.create({
      jobNumber,
      jobDate: new Date(),
      vendorId,
      targetDate: new Date(targetDate),
      remarks: remarks?.trim(),
      status: 'draft',
      jobCircuits: built.jobCircuits,
      materialRequirement: built.materialRequirement,
      totalEstimatedCost: built.totalEstimatedCost,
      createdById: req.user!._id,
    });

    res.status(201).json({ message: 'Job saved as draft', data: job });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'A job with this job number already exists - please retry' });
      return;
    }
    res.status(500).json({ message: error.message || 'Error creating job' });
  }
};

export const updateJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }
    if (job.status !== 'draft') {
      res.status(400).json({
        message: `Job is '${job.status}' and can no longer be edited. Only Draft jobs can be modified.`,
      });
      return;
    }

    const { vendorId, targetDate, remarks, jobCircuits } = req.body;

    if (vendorId !== undefined) {
      try {
        await assertVendorActiveForJob(vendorId);
      } catch (vendorError: any) {
        res.status(400).json({ message: vendorError.message });
        return;
      }
      job.vendorId = vendorId;
    }

    if (targetDate !== undefined) {
      if (!targetDate) {
        res.status(400).json({ message: 'Target completion date is required' });
        return;
      }
      job.targetDate = new Date(targetDate);
    }

    if (remarks !== undefined) job.remarks = remarks?.trim();

    if (jobCircuits !== undefined) {
      let built;
      try {
        built = await buildJobCircuitsAndRequirement(jobCircuits);
      } catch (buildError: any) {
        res.status(400).json({ message: buildError.message });
        return;
      }
      job.jobCircuits = built.jobCircuits;
      job.materialRequirement = built.materialRequirement;
      job.totalEstimatedCost = built.totalEstimatedCost;
    }

    job.updatedById = req.user!._id;
    await job.save();

    res.json({ message: 'Draft job updated successfully', data: job });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating job' });
  }
};

// Approves a Draft job: validates vendor/component/stock state against the
// job's own historical requirement snapshot, then atomically reserves every
// required component. Uses a REAL MongoDB transaction only - see
// withRequiredTransaction for why no non-transactional fallback exists here.
// Exported as a plain function (not just the Express handler below) so it
// can be exercised directly in tests without an HTTP layer, matching how
// buildJobCircuitsAndRequirement is tested elsewhere in this file.
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
