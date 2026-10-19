import { Response } from 'express';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { withTransaction } from '../utils/transaction.js';

// Get Components with filtering, search, and pagination
export const getComponents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, categoryId, locationId, lowStockOnly, page = 1, limit = 50 } = req.query;

    const query: any = { isActive: true };

    if (search) {
      query.$or = [
        { partCode: { $regex: search as string, $options: 'i' } },
        { name: { $regex: search as string, $options: 'i' } },
        { package: { $regex: search as string, $options: 'i' } },
      ];
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (locationId) {
      query.locationId = locationId;
    }

    if (lowStockOnly === 'true') {
      // low stock: inStoreStock <= minStock
      query.$expr = { $lte: ['$inStoreStock', '$minStock'] };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [components, total] = await Promise.all([
      Component.find(query)
        .populate('categoryId', 'name')
        .populate('unitId', 'name shortCode')
        .populate('locationId', 'name zone')
        .sort({ partCode: 1 })
        .skip(skip)
        .limit(limitNum),
      Component.countDocuments(query),
    ]);

    res.json({
      data: components,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching components' });
  }
};

// Get single component details with full stock breakdown and recent ledger
export const getComponentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const component = await Component.findById(id)
      .populate('categoryId', 'name')
      .populate('unitId', 'name shortCode')
      .populate('locationId', 'name zone');

    if (!component) {
      res.status(404).json({ message: 'Component not found' });
      return;
    }

    // Fetch recent stock ledger transactions for this component
    const ledger = await StockTransaction.find({ componentId: id })
      .populate('createdById', 'name email')
      .populate('vendorId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      component,
      ledger,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching component details' });
  }
};

// Create a new component + post Opening Stock to Ledger
export const createComponent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      partCode,
      name,
      categoryId,
      unitId,
      locationId,
      package: pkg,
      specifications,
      minStock = 0,
      ratePerUnit = 0,
      openingStock = 0,
      datasheetUrl,
      imageUrl,
    } = req.body;

    if (!partCode?.trim() || !name?.trim() || !categoryId || !unitId) {
      res.status(400).json({ message: 'Part Code, Name, Category and Unit are required' });
      return;
    }

    const cleanPartCode = partCode.trim().toUpperCase();

    const existing = await Component.findOne({ partCode: cleanPartCode });
    if (existing) {
      res.status(400).json({ message: `Part code '${cleanPartCode}' already exists` });
      return;
    }

    const openingStockQty = Math.max(0, Number(openingStock) || 0);

    const result = await withTransaction(async (session) => {
      // 1. Create the component document
      const componentDocs = await Component.create(
        [
          {
            partCode: cleanPartCode,
            name: name.trim(),
            categoryId,
            unitId,
            locationId: locationId || undefined,
            package: pkg?.trim(),
            specifications: specifications || {},
            inStoreStock: openingStockQty,
            reservedStock: 0,
            withVendorStock: 0,
            minStock: Math.max(0, Number(minStock) || 0),
            ratePerUnit: Math.max(0, Number(ratePerUnit) || 0),
            datasheetUrl: datasheetUrl?.trim(),
            imageUrl: imageUrl?.trim(),
            isActive: true,
          },
        ],
        session ? { session } : {}
      );

      const component = componentDocs[0];

      // 2. If opening stock > 0, post entry to immutable StockTransaction ledger
      if (openingStockQty > 0) {
        await StockTransaction.create(
          [
            {
              componentId: component._id,
              type: 'OPENING',
              locationType: 'STORE',
              qtyChange: openingStockQty,
              balanceInStoreAfter: openingStockQty,
              balanceReservedAfter: 0,
              balanceWithVendorAfter: 0,
              referenceType: 'OPENING',
              referenceId: component._id,
              notes: 'Initial opening stock entry',
              createdById: req.user?._id,
            },
          ],
          session ? { session } : {}
        );
      }

      return component;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error creating component' });
  }
};

// Update component metadata (stock amounts are never modified here!)
export const updateComponent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      categoryId,
      unitId,
      locationId,
      package: pkg,
      specifications,
      minStock,
      ratePerUnit,
      datasheetUrl,
      imageUrl,
    } = req.body;

    const component = await Component.findById(id);
    if (!component) {
      res.status(404).json({ message: 'Component not found' });
      return;
    }

    if (name) component.name = name.trim();
    if (categoryId) component.categoryId = categoryId;
    if (unitId) component.unitId = unitId;
    if (locationId !== undefined) component.locationId = locationId || undefined;
    if (pkg !== undefined) component.package = pkg;
    if (specifications !== undefined) component.specifications = specifications;
    if (minStock !== undefined) component.minStock = Math.max(0, Number(minStock));
    if (ratePerUnit !== undefined) component.ratePerUnit = Math.max(0, Number(ratePerUnit));
    if (datasheetUrl !== undefined) component.datasheetUrl = datasheetUrl;
    if (imageUrl !== undefined) component.imageUrl = imageUrl;

    await component.save();
    res.json(component);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating component' });
  }
};

// Stock Adjustment (Add or Reduce quantity with mandatory reason and ledger entry)
export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { qtyChange, reason, notes } = req.body;

    const change = Number(qtyChange);
    if (isNaN(change) || change === 0) {
      res.status(400).json({ message: 'Valid non-zero quantity change is required' });
      return;
    }

    if (!reason || !['damage', 'count_correction', 'lost', 'other'].includes(reason)) {
      res.status(400).json({
        message: "Mandatory reason required: 'damage', 'count_correction', 'lost', or 'other'",
      });
      return;
    }

    const result = await withTransaction(async (session) => {
      // Atomic conditional update: the $expr guard re-evaluates
      // inStoreStock + change >= reservedStock against whatever the document's
      // CURRENT values are at the moment MongoDB applies the update, not the
      // values we read earlier. This closes the lost-update race where two
      // concurrent adjustments both read the same starting stock and the
      // second silently overwrites the first's change.
      const updatedComponent = await Component.findOneAndUpdate(
        {
          _id: id,
          $expr: { $gte: [{ $add: ['$inStoreStock', change] }, '$reservedStock'] },
        },
        { $inc: { inStoreStock: change } },
        { new: true, session: session || undefined }
      );

      if (!updatedComponent) {
        // Either the component doesn't exist, or the guard failed (the
        // change would take store stock negative or below active reservations).
        const existing = await Component.findById(id).session(session || null);
        if (!existing) {
          throw new Error('Component not found');
        }
        if (change < 0) {
          throw new Error(
            `Negative stock prohibited. Available store stock: ${existing.inStoreStock}, attempted reduction: ${Math.abs(change)}`
          );
        }
        throw new Error(
          `Cannot reduce stock below active reservations (${existing.reservedStock} reserved).`
        );
      }

      // Create ledger transaction
      const ledgerEntry = await StockTransaction.create(
        [
          {
            componentId: updatedComponent._id,
            type: 'ADJUSTMENT',
            locationType: 'STORE',
            qtyChange: change,
            balanceInStoreAfter: updatedComponent.inStoreStock,
            balanceReservedAfter: updatedComponent.reservedStock,
            balanceWithVendorAfter: updatedComponent.withVendorStock,
            referenceType: 'ADJUSTMENT',
            adjustmentReason: reason,
            notes: notes || `Stock manual adjustment: ${reason}`,
            createdById: req.user?._id,
          },
        ],
        session ? { session } : {}
      );

      return { component: updatedComponent, ledgerEntry: ledgerEntry[0] };
    });

    res.json({
      message: 'Stock adjusted successfully',
      component: result.component,
      ledgerEntry: result.ledgerEntry,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error adjusting stock' });
  }
};

// Soft delete / deactivate component
export const deleteComponent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const component = await Component.findById(id);

    if (!component) {
      res.status(404).json({ message: 'Component not found' });
      return;
    }

    if (component.inStoreStock > 0 || component.reservedStock > 0 || component.withVendorStock > 0) {
      res.status(400).json({
        message: 'Cannot delete component with remaining stock in store, reserved, or with vendor.',
      });
      return;
    }

    component.isActive = false;
    await component.save();

    res.json({ message: 'Component deactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting component' });
  }
};
