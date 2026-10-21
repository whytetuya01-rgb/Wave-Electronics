import { Response } from 'express';
import { Vendor } from '../models/Vendor.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { escapeRegex } from '../utils/regex.js';

// Get all vendors with search, filtering, and stats
export const getVendors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    const query: any = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { contactPerson: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { phone: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { city: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { gstNumber: { $regex: escapeRegex(String(search)), $options: 'i' } },
      ];
    }

    const vendors = await Vendor.find(query).sort({ name: 1 });

    // Aggregate stats per vendor
    const vendorIds = vendors.map((v) => v._id);
    
    // Find material movements with these vendors
    const transactions = await StockTransaction.aggregate([
      { $match: { vendorId: { $in: vendorIds } } },
      {
        $group: {
          _id: '$vendorId',
          totalIssued: {
            $sum: {
              $cond: [{ $eq: ['$type', 'ISSUE_TO_VENDOR'] }, '$qtyChange', 0],
            },
          },
          totalReturned: {
            $sum: {
              $cond: [{ $eq: ['$type', 'RETURN_FROM_VENDOR'] }, '$qtyChange', 0],
            },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    const statsMap = new Map();
    transactions.forEach((t) => {
      statsMap.set(t._id.toString(), {
        materialBalance: Math.max(0, (t.totalIssued || 0) - (t.totalReturned || 0)),
        transactionCount: t.totalTransactions,
      });
    });

    const enrichedVendors = vendors.map((v) => {
      const stats = statsMap.get(v._id.toString()) || { materialBalance: 0, transactionCount: 0 };
      return {
        ...v.toObject(),
        openJobsCount: 0, // Placeholder until Day 4 Jobs module
        pendingFinishedQty: 0,
        materialBalance: stats.materialBalance,
        transactionCount: stats.transactionCount,
      };
    });

    res.json({
      data: enrichedVendors,
      meta: {
        total: enrichedVendors.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching vendors' });
  }
};

// Get single vendor by ID with full details & material ledger
export const getVendorById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }

    // Fetch related stock transactions with components populated
    const transactions = await StockTransaction.find({ vendorId: vendor._id })
      .populate('componentId', 'partCode name package unitId')
      .populate('createdById', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    // Calculate material holding by component
    const componentHolding = await StockTransaction.aggregate([
      { $match: { vendorId: vendor._id } },
      {
        $group: {
          _id: '$componentId',
          netBalance: { $sum: '$qtyChange' },
        },
      },
      {
        $lookup: {
          from: 'components',
          localField: '_id',
          foreignField: '_id',
          as: 'component',
        },
      },
      { $unwind: '$component' },
      {
        $project: {
          componentId: '$_id',
          partCode: '$component.partCode',
          name: '$component.name',
          netBalance: 1,
        },
      },
      { $match: { netBalance: { $gt: 0 } } },
    ]);

    res.json({
      data: {
        ...vendor.toObject(),
        openJobsCount: 0,
        pendingFinishedQty: 0,
        materialHoldings: componentHolding,
        recentTransactions: transactions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching vendor details' });
  }
};

// Create a new vendor
export const createVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      gstNumber,
      address,
      city,
      state,
      circuitsCanAssemble,
      vendorCircuitRates,
      defaultJobWorkRate,
      remarks,
    } = req.body;

    if (!name || !contactPerson || !phone || !city) {
      res.status(400).json({ message: 'Company name, contact person, phone, and city are required' });
      return;
    }

    // Check duplicate name or GST if provided
    const existing = await Vendor.findOne({
      $or: [
        { name: { $regex: `^${name.trim()}$`, $options: 'i' } },
        ...(gstNumber ? [{ gstNumber: gstNumber.trim().toUpperCase() }] : []),
      ],
    });

    if (existing) {
      if (existing.name.toLowerCase() === name.trim().toLowerCase()) {
        res.status(400).json({ message: `Vendor with name '${name}' already exists` });
        return;
      }
      if (gstNumber && existing.gstNumber === gstNumber.trim().toUpperCase()) {
        res.status(400).json({ message: `Vendor with GST number '${gstNumber}' already exists` });
        return;
      }
    }

    const vendor = await Vendor.create({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email?.trim(),
      gstNumber: gstNumber?.trim().toUpperCase(),
      address: address?.trim(),
      city: city.trim(),
      state: state?.trim() || 'Maharashtra',
      circuitsCanAssemble: Array.isArray(circuitsCanAssemble) ? circuitsCanAssemble : [],
      vendorCircuitRates: Array.isArray(vendorCircuitRates) ? vendorCircuitRates : [],
      defaultJobWorkRate: Number(defaultJobWorkRate) || 0,
      remarks: remarks?.trim(),
      isActive: true,
    });

    res.status(201).json({
      message: 'Vendor created successfully',
      data: vendor,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error creating vendor' });
  }
};

// Update an existing vendor
export const updateVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      contactPerson,
      phone,
      email,
      gstNumber,
      address,
      city,
      state,
      circuitsCanAssemble,
      vendorCircuitRates,
      defaultJobWorkRate,
      remarks,
      isActive,
    } = req.body;

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }

    if (name) vendor.name = name.trim();
    if (contactPerson) vendor.contactPerson = contactPerson.trim();
    if (phone) vendor.phone = phone.trim();
    if (email !== undefined) vendor.email = email.trim();
    if (gstNumber !== undefined) vendor.gstNumber = gstNumber.trim().toUpperCase();
    if (address !== undefined) vendor.address = address.trim();
    if (city) vendor.city = city.trim();
    if (state !== undefined) vendor.state = state.trim();
    if (circuitsCanAssemble !== undefined) vendor.circuitsCanAssemble = circuitsCanAssemble;
    if (vendorCircuitRates !== undefined) vendor.vendorCircuitRates = vendorCircuitRates;
    if (defaultJobWorkRate !== undefined) vendor.defaultJobWorkRate = Number(defaultJobWorkRate);
    if (remarks !== undefined) vendor.remarks = remarks.trim();
    if (isActive !== undefined) vendor.isActive = Boolean(isActive);

    await vendor.save();

    res.json({
      message: 'Vendor updated successfully',
      data: vendor,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating vendor' });
  }
};

// Toggle active/inactive status
export const toggleVendorStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }

    vendor.isActive = !vendor.isActive;
    await vendor.save();

    res.json({
      message: `Vendor ${vendor.isActive ? 'activated' : 'deactivated'} successfully`,
      data: vendor,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error toggling vendor status' });
  }
};

// Delete vendor (blocked if transactions or material exist)
export const deleteVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      res.status(404).json({ message: 'Vendor not found' });
      return;
    }

    // Check if transactions exist
    const hasTransactions = await StockTransaction.exists({ vendorId: vendor._id });
    if (hasTransactions) {
      res.status(400).json({
        message: 'Cannot delete vendor because stock transactions or material movements are linked to it. Deactivate instead.',
      });
      return;
    }

    await Vendor.findByIdAndDelete(vendor._id);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting vendor' });
  }
};
