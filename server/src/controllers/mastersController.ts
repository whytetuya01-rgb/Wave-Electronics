import { Request, Response } from 'express';
import { Category } from '../models/Category.js';
import { Unit } from '../models/Unit.js';
import { Location } from '../models/Location.js';
import { Component } from '../models/Component.js';
import { escapeRegex } from '../utils/regex.js';

// Case-insensitive exact match, so "Resistor" and "resistor" count as the
// same name. The input is escaped: names like "IC (SMD)" or "C++" are text,
// not patterns.
const sameText = (value: string) => new RegExp(`^${escapeRegex(value.trim())}$`, 'i');

// How many components use each master record, keyed by its id. Lists return
// this as componentCount, so the page can show it and disable delete for
// records in use (the delete handlers enforce the same rule).
async function componentCounts(field: 'categoryId' | 'unitId' | 'locationId'): Promise<Map<string, number>> {
  const rows = await Component.aggregate([{ $match: { [field]: { $ne: null } } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return new Map(rows.map((r: { _id: unknown; count: number }) => [String(r._id), r.count]));
}

function withCounts<T extends { _id: unknown }>(records: T[], counts: Map<string, number>) {
  return records.map((r) => ({ ...r, componentCount: counts.get(String(r._id)) || 0 }));
}

// ==================== CATEGORIES ====================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const [categories, counts] = await Promise.all([Category.find().sort({ name: 1 }).lean(), componentCounts('categoryId')]);
    res.json(withCounts(categories, counts));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }

    const existing = await Category.findOne({ name: sameText(name) });
    if (existing) {
      res.status(400).json({ message: `Category '${name.trim()}' already exists` });
      return;
    }

    const category = await Category.create({ name: name.trim(), description: description?.trim() });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (name !== undefined && !String(name).trim()) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({ _id: { $ne: id }, name: sameText(name) });
      if (existing) {
        res.status(400).json({ message: `Category '${name.trim()}' already exists` });
        return;
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = String(description).trim();

    await category.save();
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // RULE: Delete blocked if components are linked
    const linkedCount = await Component.countDocuments({ categoryId: id });
    if (linkedCount > 0) {
      res.status(400).json({
        message: `Cannot delete this category: ${linkedCount} component(s) use it. Move them to another category first.`,
      });
      return;
    }

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== UNITS ====================
export const getUnits = async (req: Request, res: Response): Promise<void> => {
  try {
    const [units, counts] = await Promise.all([Unit.find().sort({ name: 1 }).lean(), componentCounts('unitId')]);
    res.json(withCounts(units, counts));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// The unit with this name or short code, other than `excludeId`, if any.
async function findUnitClash(name: string, shortCode: string, excludeId?: string) {
  return Unit.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ name: sameText(name) }, { shortCode: shortCode.trim().toUpperCase() }],
  });
}

export const createUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, shortCode } = req.body;
    if (!name?.trim() || !shortCode?.trim()) {
      res.status(400).json({ message: 'Unit name and shortCode are required' });
      return;
    }

    if (await findUnitClash(name, shortCode)) {
      res.status(400).json({ message: 'Unit with this name or code already exists' });
      return;
    }

    const unit = await Unit.create({
      name: name.trim(),
      shortCode: shortCode.trim().toUpperCase(),
    });
    res.status(201).json(unit);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Unit with this name or code already exists' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

// Renaming a unit changes it everywhere components show it (they reference
// it by id); documents already issued keep the code they were printed with.
export const updateUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, shortCode } = req.body;
    if (!name?.trim() || !shortCode?.trim()) {
      res.status(400).json({ message: 'Unit name and shortCode are required' });
      return;
    }

    const unit = await Unit.findById(id);
    if (!unit) {
      res.status(404).json({ message: 'Unit not found' });
      return;
    }

    if (await findUnitClash(name, shortCode, String(id))) {
      res.status(400).json({ message: 'Unit with this name or code already exists' });
      return;
    }

    unit.name = name.trim();
    unit.shortCode = shortCode.trim().toUpperCase();
    await unit.save();
    res.json(unit);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Unit with this name or code already exists' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const linkedCount = await Component.countDocuments({ unitId: id });
    if (linkedCount > 0) {
      res.status(400).json({
        message: `Cannot delete this unit: ${linkedCount} component(s) use it.`,
      });
      return;
    }
    const deleted = await Unit.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: 'Unit not found' });
      return;
    }
    res.json({ message: 'Unit deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== LOCATIONS ====================
export const getLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const [locations, counts] = await Promise.all([Location.find().sort({ name: 1 }).lean(), componentCounts('locationId')]);
    res.json(withCounts(locations, counts));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, zone, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Location name/code is required' });
      return;
    }

    if (await Location.findOne({ name: sameText(name) })) {
      res.status(400).json({ message: 'Location with this name already exists' });
      return;
    }

    const location = await Location.create({
      name: name.trim(),
      zone: zone?.trim(),
      description: description?.trim(),
    });
    res.status(201).json(location);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Location with this name already exists' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, zone, description } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Location name/code is required' });
      return;
    }

    const location = await Location.findById(id);
    if (!location) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }

    if (await Location.findOne({ _id: { $ne: id }, name: sameText(name) })) {
      res.status(400).json({ message: 'Location with this name already exists' });
      return;
    }

    location.name = name.trim();
    if (zone !== undefined) location.zone = String(zone).trim();
    if (description !== undefined) location.description = String(description).trim();
    await location.save();
    res.json(location);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Location with this name already exists' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const linkedCount = await Component.countDocuments({ locationId: id });
    if (linkedCount > 0) {
      res.status(400).json({
        message: `Cannot delete this location: ${linkedCount} component(s) are stored there.`,
      });
      return;
    }
    const deleted = await Location.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    res.json({ message: 'Location deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
