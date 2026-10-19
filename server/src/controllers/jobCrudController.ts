import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { Job, IJobCircuit, IJobMaterialRequirement } from '../models/Job.js';
import { Vendor } from '../models/Vendor.js';
import { Circuit } from '../models/Circuit.js';
import { Component } from '../models/Component.js';
import { AuthRequest } from '../middleware/auth.js';
import { getNextSequence } from '../utils/sequence.js';

interface RawJobCircuit {
  circuitId: string;
  orderedQty: number | string;
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
