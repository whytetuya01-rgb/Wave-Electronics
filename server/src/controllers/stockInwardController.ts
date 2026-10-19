import { Response } from 'express';
import { ClientSession } from 'mongoose';
import { StockInward, IStockInwardItem } from '../models/StockInward.js';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { withTransaction } from '../utils/transaction.js';
import { getNextSequence } from '../utils/sequence.js';

// Generates auto formatted inward number: INW-YYYYMM-XXXX using an atomic
// per-month counter, so concurrent requests can never be issued the same
// number (previously this read-then-incremented in application code, which
// could hand out duplicates under concurrent submission).
export async function generateInwardNumber(session?: ClientSession | null): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INW-${yearMonth}-`;
  const counterKey = `stockInward-${yearMonth}`;

  const seq = await getNextSequence(counterKey, {
    session,
    // First-ever use of this month's counter: seed it from any pre-existing
    // inward records (e.g. seed data created before the counter existed)
    // so newly generated numbers can't collide with them.
    initFrom: async () => {
      const latestInward = await StockInward.findOne({ inwardNumber: { $regex: `^${prefix}` } })
        .sort({ inwardNumber: -1 })
        .select('inwardNumber')
        .session(session || null);

      if (!latestInward?.inwardNumber) return 0;

      const parts = latestInward.inwardNumber.split('-');
      const currentSeq = parts.length === 3 ? parseInt(parts[2], 10) : NaN;
      return isNaN(currentSeq) ? 0 : currentSeq;
    },
  });

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Get Stock Inward records with search, date filters, and pagination
export const getStockInwards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, startDate, endDate, page = 1, limit = 25 } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { inwardNumber: { $regex: search as string, $options: 'i' } },
        { supplierName: { $regex: search as string, $options: 'i' } },
        { billNumber: { $regex: search as string, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.inwardDate = {};
      if (startDate) {
        query.inwardDate.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.inwardDate.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    const [inwards, total] = await Promise.all([
      StockInward.find(query)
        .populate('createdById', 'name email role')
        .sort({ inwardDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      StockInward.countDocuments(query),
    ]);

    // Calculate aggregated metrics for the summary cards
    const totalAmountAgg = await StockInward.aggregate([
      { $group: { _id: null, totalValue: { $sum: '$totalAmount' }, totalUnits: { $sum: '$totalQty' } } },
    ]);

    const totalValueAllTime = totalAmountAgg[0]?.totalValue || 0;
    const totalUnitsAllTime = totalAmountAgg[0]?.totalUnits || 0;

    res.json({
      data: inwards,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalValueAllTime,
        totalUnitsAllTime,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching stock inwards' });
  }
};

// Get single stock inward by ID (for view & printable invoice slip)
export const getStockInwardById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const inward = await StockInward.findById(req.params.id)
      .populate('createdById', 'name email role')
      .populate('items.componentId', 'partCode name package unitId locationId');

    if (!inward) {
      res.status(404).json({ message: 'Stock inward record not found' });
      return;
    }

    res.json({ data: inward });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching stock inward' });
  }
};

// Create new stock inward entry
export const createStockInward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplierName, billNumber, billDate, inwardDate, notes, items } = req.body;

    if (!supplierName || !supplierName.trim()) {
      res.status(400).json({ message: 'Supplier/Source name is required' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'At least one component item is required in the inward entry' });
      return;
    }

    // Validate items structure
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.componentId) {
        res.status(400).json({ message: `Row ${i + 1}: Component selection is required` });
        return;
      }
      if (!item.qty || Number(item.qty) <= 0) {
        res.status(400).json({ message: `Row ${i + 1}: Quantity must be greater than zero` });
        return;
      }
      if (item.unitRate === undefined || Number(item.unitRate) < 0) {
        res.status(400).json({ message: `Row ${i + 1}: Unit rate cannot be negative` });
        return;
      }
    }

    const createdInward = await withTransaction(async (session) => {
      const inwardNumber = await generateInwardNumber(session);

      let calculatedTotalQty = 0;
      let calculatedTotalAmount = 0;
      const sanitizedItems: IStockInwardItem[] = [];

      for (const rawItem of items) {
        const qty = Number(rawItem.qty);
        const unitRate = Number(rawItem.unitRate);
        const lineTotal = Number((qty * unitRate).toFixed(2));

        const component = await Component.findById(rawItem.componentId).session(session || null);
        if (!component) {
          throw new Error(`Component with ID ${rawItem.componentId} not found`);
        }

        sanitizedItems.push({
          componentId: component._id,
          partCode: component.partCode,
          name: component.name,
          unitShortCode: rawItem.unitShortCode || 'NOS',
          qty,
          unitRate,
          totalAmount: lineTotal,
          remarks: rawItem.remarks?.trim(),
        });

        calculatedTotalQty += qty;
        calculatedTotalAmount += lineTotal;

        // Atomically increase component stock in store. Using $inc instead of
        // a read-modify-save round trip means concurrent inward entries for
        // the same component can never lose an update to each other.
        const updateOps: Record<string, unknown> = { $inc: { inStoreStock: qty } };
        if (unitRate > 0) {
          // Update rate per unit to latest purchase rate
          updateOps.$set = { ratePerUnit: unitRate };
        }

        const updatedComponent = await Component.findOneAndUpdate(component._id, updateOps, {
          new: true,
          session: session || undefined,
        });

        if (!updatedComponent) {
          throw new Error(`Component with ID ${rawItem.componentId} not found`);
        }

        // Record immutable stock ledger entry
        await StockTransaction.create(
          [
            {
              componentId: updatedComponent._id,
              type: 'INWARD',
              locationType: 'STORE',
              qtyChange: qty,
              balanceInStoreAfter: updatedComponent.inStoreStock,
              balanceReservedAfter: updatedComponent.reservedStock,
              balanceWithVendorAfter: updatedComponent.withVendorStock,
              referenceType: 'INWARD',
              referenceNo: inwardNumber,
              notes: `Inward from ${supplierName.trim()}${billNumber ? ` (Bill: ${billNumber.trim()})` : ''}`,
              createdById: req.user!._id,
            },
          ],
          { session: session || undefined }
        );
      }

      const [inwardDoc] = await StockInward.create(
        [
          {
            inwardNumber,
            inwardDate: inwardDate ? new Date(inwardDate) : new Date(),
            supplierName: supplierName.trim(),
            billNumber: billNumber?.trim(),
            billDate: billDate ? new Date(billDate) : undefined,
            items: sanitizedItems,
            totalItems: sanitizedItems.length,
            totalQty: calculatedTotalQty,
            totalAmount: Number(calculatedTotalAmount.toFixed(2)),
            notes: notes?.trim(),
            createdById: req.user!._id,
          },
        ],
        { session: session || undefined }
      );

      return inwardDoc;
    });

    res.status(201).json({
      message: 'Stock inward created successfully and stock balances updated',
      data: createdInward,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error creating stock inward' });
  }
};
