import { Request, Response } from 'express';
import { Category } from '../models/Category.js';
import { Unit } from '../models/Unit.js';
import { Location } from '../models/Location.js';
import { Component } from '../models/Component.js';

// ==================== CATEGORIES ====================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
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

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      res.status(400).json({ message: `Category '${name}' already exists` });
      return;
    }

    const category = await Category.create({ name: name.trim(), description });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      });
      if (existing) {
        res.status(400).json({ message: `Category '${name}' already exists` });
        return;
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;

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
        message: `Cannot delete category. It is linked to ${linkedCount} active component(s).`,
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
    const units = await Unit.find().sort({ name: 1 });
    res.json(units);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, shortCode } = req.body;
    if (!name?.trim() || !shortCode?.trim()) {
      res.status(400).json({ message: 'Unit name and shortCode are required' });
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

export const deleteUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const linkedCount = await Component.countDocuments({ unitId: id });
    if (linkedCount > 0) {
      res.status(400).json({
        message: `Cannot delete unit. It is linked to ${linkedCount} component(s).`,
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
    const locations = await Location.find().sort({ name: 1 });
    res.json(locations);
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

export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const linkedCount = await Component.countDocuments({ locationId: id });
    if (linkedCount > 0) {
      res.status(400).json({
        message: `Cannot delete location. It is linked to ${linkedCount} component(s).`,
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
