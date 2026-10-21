import { Response } from 'express';
import mongoose from 'mongoose';
import { Circuit, ICircuitBomItem } from '../models/Circuit.js';
import { Component } from '../models/Component.js';
import { AuthRequest } from '../middleware/auth.js';
import { computeCircuitAvailability } from '../utils/circuitCalculations.js';
import { escapeRegex } from '../utils/regex.js';

interface RawBomItem {
  componentId: string;
  qtyPerUnit: number | string;
  designator?: string;
  remarks?: string;
}

// Shared validation for create and edit: enforces every BOM rule from the
// spec (no duplicate components, positive quantities, valid + active
// component references) and returns clean, typed BOM items ready to persist.
export async function validateAndSanitizeBomItems(rawBomItems: RawBomItem[]): Promise<ICircuitBomItem[]> {
  if (!Array.isArray(rawBomItems) || rawBomItems.length === 0) {
    throw new Error('At least one BOM component is required');
  }

  const seen = new Set<string>();
  const sanitized: ICircuitBomItem[] = [];

  for (let i = 0; i < rawBomItems.length; i++) {
    const row = rawBomItems[i];
    if (!row.componentId || !mongoose.isValidObjectId(row.componentId)) {
      throw new Error(`Row ${i + 1}: a valid component selection is required`);
    }

    const qty = Number(row.qtyPerUnit);
    if (!qty || qty <= 0) {
      throw new Error(`Row ${i + 1}: quantity per circuit must be greater than zero`);
    }

    if (seen.has(row.componentId)) {
      throw new Error(`Row ${i + 1}: this component is already in the BOM - a BOM cannot contain the same component twice`);
    }
    seen.add(row.componentId);

    sanitized.push({
      componentId: new mongoose.Types.ObjectId(row.componentId),
      qtyPerUnit: qty,
      designator: row.designator?.trim() || undefined,
      remarks: row.remarks?.trim() || undefined,
    } as ICircuitBomItem);
  }

  const components = await Component.find({ _id: { $in: sanitized.map((s) => s.componentId) } });
  const componentById = new Map(components.map((c) => [c._id.toString(), c]));

  for (const item of sanitized) {
    const idStr = item.componentId.toString();
    const component = componentById.get(idStr);
    if (!component) {
      throw new Error(`Component with ID ${idStr} does not exist`);
    }
    if (!component.isActive) {
      throw new Error(`Component '${component.partCode}' is inactive and cannot be added to a BOM`);
    }
  }

  return sanitized;
}

// Attaches computed cost/availability summary fields to a (lean) circuit
// object for list responses, where the full per-line breakdown isn't needed.
async function enrichCircuitSummary(circuit: any) {
  const availability = await computeCircuitAvailability(circuit.bomItems);
  return {
    ...circuit,
    materialCostPerUnit: availability.materialCostPerUnit,
    maxBuildableQty: availability.maxBuildableQty,
    bottleneckComponentId: availability.bottleneckComponentId,
    bomItemCount: circuit.bomItems?.length || 0,
  };
}

export const getCircuits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, page = 1, limit = 25 } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { circuitCode: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { name: { $regex: escapeRegex(String(search)), $options: 'i' } },
      ];
    }
    if (status === 'active' || status === 'inactive') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [circuits, total] = await Promise.all([
      Circuit.find(query)
        .populate('createdById', 'name email')
        .sort({ circuitCode: 1, version: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Circuit.countDocuments(query),
    ]);

    const enriched = await Promise.all(circuits.map((c) => enrichCircuitSummary(c)));

    res.json({
      data: enriched,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching circuits' });
  }
};

export const getCircuitById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const circuit = await Circuit.findById(req.params.id)
      .populate('bomItems.componentId', 'partCode name unitId package ratePerUnit inStoreStock reservedStock isActive')
      .populate('createdById', 'name email')
      .populate('updatedById', 'name email')
      .lean();

    if (!circuit) {
      res.status(404).json({ message: 'Circuit not found' });
      return;
    }

    const availability = await computeCircuitAvailability(circuit.bomItems as any);

    res.json({
      data: {
        ...circuit,
        materialCostPerUnit: availability.materialCostPerUnit,
        maxBuildableQty: availability.maxBuildableQty,
        bottleneckComponentId: availability.bottleneckComponentId,
        bomAvailability: availability.lines,
        linkedJobs: [], // Placeholder until the Jobs module is implemented
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching circuit details' });
  }
};

export const getCircuitAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const circuit = await Circuit.findById(req.params.id);
    if (!circuit) {
      res.status(404).json({ message: 'Circuit not found' });
      return;
    }
    const availability = await computeCircuitAvailability(circuit.bomItems);
    res.json({ data: availability });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error computing circuit availability' });
  }
};

export const createCircuit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { circuitCode, name, version, description, bomItems } = req.body;

    if (!circuitCode?.trim() || !name?.trim()) {
      res.status(400).json({ message: 'Circuit code and name are required' });
      return;
    }

    const cleanCode = circuitCode.trim().toUpperCase();
    const cleanVersion = (version?.trim() || '1.0') as string;

    const existing = await Circuit.findOne({ circuitCode: cleanCode, version: cleanVersion });
    if (existing) {
      res.status(400).json({ message: `Circuit '${cleanCode}' version '${cleanVersion}' already exists` });
      return;
    }

    let sanitizedBom: ICircuitBomItem[];
    try {
      sanitizedBom = await validateAndSanitizeBomItems(bomItems);
    } catch (bomError: any) {
      res.status(400).json({ message: bomError.message });
      return;
    }

    // Circuit creation never touches component stock - it only defines a
    // recipe. Reservation happens later, at Job Approval.
    const circuit = await Circuit.create({
      circuitCode: cleanCode,
      name: name.trim(),
      version: cleanVersion,
      description: description?.trim(),
      status: 'active',
      bomItems: sanitizedBom,
      isLocked: false,
      createdById: req.user!._id,
    });

    res.status(201).json({ message: 'Circuit created successfully', data: circuit });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Circuit code and version combination already exists' });
      return;
    }
    res.status(500).json({ message: error.message || 'Error creating circuit' });
  }
};

export const updateCircuit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, bomItems } = req.body;
    const circuit = await Circuit.findById(req.params.id);

    if (!circuit) {
      res.status(404).json({ message: 'Circuit not found' });
      return;
    }

    if (circuit.isLocked) {
      res.status(400).json({
        message:
          'This circuit version is locked because it is referenced by an approved or issued job and can no longer be edited. Duplicate it as a new version instead.',
      });
      return;
    }

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ message: 'Circuit name cannot be empty' });
        return;
      }
      circuit.name = name.trim();
    }
    if (description !== undefined) circuit.description = description?.trim();

    if (bomItems !== undefined) {
      try {
        circuit.bomItems = await validateAndSanitizeBomItems(bomItems);
      } catch (bomError: any) {
        res.status(400).json({ message: bomError.message });
        return;
      }
    }

    circuit.updatedById = req.user!._id;
    await circuit.save();

    res.json({ message: 'Circuit updated successfully', data: circuit });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating circuit' });
  }
};

export const toggleCircuitStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const circuit = await Circuit.findById(req.params.id);
    if (!circuit) {
      res.status(404).json({ message: 'Circuit not found' });
      return;
    }

    circuit.status = circuit.status === 'active' ? 'inactive' : 'active';
    circuit.updatedById = req.user!._id;
    await circuit.save();

    res.json({
      message: `Circuit ${circuit.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: circuit,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating circuit status' });
  }
};

export const duplicateCircuit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newVersion } = req.body;
    if (!newVersion?.trim()) {
      res.status(400).json({ message: "New version label is required (e.g. '2.0')" });
      return;
    }

    const source = await Circuit.findById(req.params.id);
    if (!source) {
      res.status(404).json({ message: 'Source circuit not found' });
      return;
    }

    const cleanVersion = newVersion.trim();
    if (cleanVersion === source.version) {
      res.status(400).json({ message: 'New version must differ from the source version' });
      return;
    }

    const existing = await Circuit.findOne({ circuitCode: source.circuitCode, version: cleanVersion });
    if (existing) {
      res.status(400).json({ message: `Circuit '${source.circuitCode}' version '${cleanVersion}' already exists` });
      return;
    }

    // Deep-copy BOM rows into fresh subdocuments so the new version is fully
    // independent of the source - editing it can never alter the original
    // (and any future job referencing the original).
    const duplicate = await Circuit.create({
      circuitCode: source.circuitCode,
      name: source.name,
      version: cleanVersion,
      description: source.description,
      status: 'active',
      bomItems: source.bomItems.map((item) => ({
        componentId: item.componentId,
        qtyPerUnit: item.qtyPerUnit,
        designator: item.designator,
        remarks: item.remarks,
      })),
      isLocked: false,
      createdById: req.user!._id,
    });

    res.status(201).json({ message: `Circuit duplicated as version '${cleanVersion}'`, data: duplicate });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Circuit code and version combination already exists' });
      return;
    }
    res.status(500).json({ message: error.message || 'Error duplicating circuit' });
  }
};
