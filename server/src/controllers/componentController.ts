import { Response } from 'express';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { Category } from '../models/Category.js';
import { Unit } from '../models/Unit.js';
import { Location } from '../models/Location.js';
import { AuthRequest } from '../middleware/auth.js';
import { withTransaction } from '../utils/transaction.js';
import { logActivity } from '../services/activityLog.js';
import { escapeRegex } from '../utils/regex.js';

// Get Components with filtering, search, and pagination
export const getComponents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, categoryId, locationId, lowStockOnly, page = 1, limit = 50 } = req.query;

    const query: any = { isActive: true };

    if (search) {
      query.$or = [
        { partCode: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { name: { $regex: escapeRegex(String(search)), $options: 'i' } },
        { package: { $regex: escapeRegex(String(search)), $options: 'i' } },
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

    logActivity({
      userId: String(req.user!._id),
      userName: req.user!.name,
      action: `Adjusted stock (${change > 0 ? '+' : ''}${change})`,
      module: 'component',
      targetId: String(result.component._id),
      targetLabel: result.component.partCode,
      details: `Reason: ${reason}${notes ? ` — ${notes}` : ''}`,
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

interface BulkImportRow {
  partCode: string;
  name: string;
  categoryName: string;
  unitName: string;
  locationName?: string;
  package?: string;
  minStock?: number | string;
  ratePerUnit?: number | string;
  openingStock?: number | string;
}

interface BulkImportRowResult {
  row: number;
  partCode: string;
  status: 'created' | 'error';
  message?: string;
}

// Bulk import components from a client-parsed CSV. Re-validates everything
// server-side (never trusts the preview the client already showed the
// user) and commits all rows in a single transaction: if any row fails,
// nothing is created, so a batch can never partially land in the catalog.
// Reuses exactly the same component+opening-stock-ledger pattern as
// createComponent, just looped.
export const bulkImportComponents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = req.body as { rows: BulkImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ message: 'At least one row is required for bulk import' });
      return;
    }
    if (rows.length > 500) {
      res.status(400).json({ message: 'Bulk import is limited to 500 rows per batch' });
      return;
    }

    const errors: BulkImportRowResult[] = [];
    const seenPartCodes = new Set<string>();
    const existingPartCodes = new Set(
      (await Component.find({}).select('partCode').lean()).map((c) => c.partCode)
    );

    const categories = await Category.find({}).lean();
    const units = await Unit.find({}).lean();
    const locations = await Location.find({}).lean();
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c._id]));
    const unitByName = new Map(units.map((u) => [u.name.toLowerCase(), u._id]));
    const locationByName = new Map(locations.map((l) => [l.name.toLowerCase(), l._id]));

    const prepared: Array<{
      row: number;
      partCode: string;
      name: string;
      categoryId: any;
      unitId: any;
      locationId: any;
      package?: string;
      minStock: number;
      ratePerUnit: number;
      openingStock: number;
    }> = [];

    rows.forEach((raw, idx) => {
      const rowNum = idx + 1;
      const partCode = (raw.partCode || '').trim().toUpperCase();
      const name = (raw.name || '').trim();

      if (!partCode || !name) {
        errors.push({ row: rowNum, partCode: partCode || '(blank)', status: 'error', message: 'Part code and name are required' });
        return;
      }
      if (seenPartCodes.has(partCode)) {
        errors.push({ row: rowNum, partCode, status: 'error', message: 'Duplicate part code within this import file' });
        return;
      }
      if (existingPartCodes.has(partCode)) {
        errors.push({ row: rowNum, partCode, status: 'error', message: 'Part code already exists in the catalog' });
        return;
      }

      const categoryId = categoryByName.get((raw.categoryName || '').trim().toLowerCase());
      if (!categoryId) {
        errors.push({ row: rowNum, partCode, status: 'error', message: `Category '${raw.categoryName}' not found` });
        return;
      }
      const unitId = unitByName.get((raw.unitName || '').trim().toLowerCase());
      if (!unitId) {
        errors.push({ row: rowNum, partCode, status: 'error', message: `Unit '${raw.unitName}' not found` });
        return;
      }
      const locationId = raw.locationName ? locationByName.get(raw.locationName.trim().toLowerCase()) : undefined;
      if (raw.locationName && !locationId) {
        errors.push({ row: rowNum, partCode, status: 'error', message: `Storage location '${raw.locationName}' not found` });
        return;
      }

      seenPartCodes.add(partCode);
      prepared.push({
        row: rowNum,
        partCode,
        name,
        categoryId,
        unitId,
        locationId,
        package: raw.package?.trim(),
        minStock: Math.max(0, Number(raw.minStock) || 0),
        ratePerUnit: Math.max(0, Number(raw.ratePerUnit) || 0),
        openingStock: Math.max(0, Number(raw.openingStock) || 0),
      });
    });

    if (errors.length > 0) {
      res.status(400).json({
        message: `${errors.length} row(s) failed validation - nothing was imported`,
        errors,
      });
      return;
    }

    const created = await withTransaction(async (session) => {
      const results: BulkImportRowResult[] = [];
      for (const item of prepared) {
        const componentDocs = await Component.create(
          [
            {
              partCode: item.partCode,
              name: item.name,
              categoryId: item.categoryId,
              unitId: item.unitId,
              locationId: item.locationId,
              package: item.package,
              inStoreStock: item.openingStock,
              reservedStock: 0,
              withVendorStock: 0,
              minStock: item.minStock,
              ratePerUnit: item.ratePerUnit,
              isActive: true,
            },
          ],
          session ? { session } : {}
        );
        const component = componentDocs[0];

        if (item.openingStock > 0) {
          await StockTransaction.create(
            [
              {
                componentId: component._id,
                type: 'OPENING',
                locationType: 'STORE',
                qtyChange: item.openingStock,
                balanceInStoreAfter: item.openingStock,
                balanceReservedAfter: 0,
                balanceWithVendorAfter: 0,
                referenceType: 'OPENING',
                referenceId: component._id,
                notes: 'Bulk import opening stock entry',
                createdById: req.user?._id,
              },
            ],
            session ? { session } : {}
          );
        }

        results.push({ row: item.row, partCode: item.partCode, status: 'created' });
      }
      return results;
    });

    logActivity({
      userId: String(req.user!._id),
      userName: req.user!.name,
      action: `Bulk imported ${created.length} component(s)`,
      module: 'component',
      details: created.map((c) => c.partCode).join(', ').slice(0, 500),
    });

    res.status(201).json({ message: `${created.length} component(s) imported successfully`, results: created });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error during bulk import' });
  }
};
