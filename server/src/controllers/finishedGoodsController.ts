import { Request, Response } from 'express';
import { FinishedGoods } from '../models/FinishedGoods.js';
import { FinishedGoodsTransaction } from '../models/FinishedGoodsTransaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { escapeRegex } from '../utils/regex.js';

/**
 * GET /api/finished-goods
 * Retrieves all finished goods balances with summary metrics and filtering.
 */
export const getFinishedGoods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, stockStatus } = req.query;

    const query: Record<string, any> = {};

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { circuitCode: searchRegex },
        { circuitName: searchRegex },
        { circuitVersion: searchRegex },
      ];
    }

    if (stockStatus === 'in_stock') {
      query.goodQtyBalance = { $gt: 0 };
    } else if (stockStatus === 'out_of_stock') {
      query.goodQtyBalance = { $lte: 0 };
    }

    const items = await FinishedGoods.find(query)
      .populate('circuitId', 'description pcbSize status')
      .sort({ updatedAt: -1 })
      .lean();

    // Calculate system-wide summary metrics
    const allItems = await FinishedGoods.find().lean();
    const summary = allItems.reduce(
      (acc, item) => {
        acc.totalGoodBalance += item.goodQtyBalance || 0;
        acc.totalReceivedGoodQty += item.totalReceivedGoodQty || 0;
        acc.totalRejectedQty += item.totalRejectedQty || 0;
        acc.totalDispatchedQty += item.totalDispatchedQty || 0;
        if ((item.goodQtyBalance || 0) > 0) acc.inStockCount += 1;
        else acc.outOfStockCount += 1;
        return acc;
      },
      {
        totalGoodBalance: 0,
        totalReceivedGoodQty: 0,
        totalRejectedQty: 0,
        totalDispatchedQty: 0,
        totalCircuits: allItems.length,
        inStockCount: 0,
        outOfStockCount: 0,
      }
    );

    res.json({
      data: items,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching finished goods' });
  }
};

/**
 * GET /api/finished-goods/:id
 * Retrieves a single finished goods balance record by ID.
 */
export const getFinishedGoodById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await FinishedGoods.findById(id)
      .populate('circuitId')
      .lean();

    if (!item) {
      res.status(404).json({ message: 'Finished goods record not found' });
      return;
    }

    res.json({ data: item });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching finished goods item' });
  }
};

/**
 * GET /api/finished-goods/:id/transactions
 * Retrieves transaction audit ledger for a specific finished goods record (by circuitId or FG ID).
 */
export const getFinishedGoodsTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Find the FinishedGoods record to identify its circuitId
    const fg = await FinishedGoods.findById(id).lean();
    const circuitId = fg ? fg.circuitId : id;

    const transactions = await FinishedGoodsTransaction.find({ circuitId })
      .populate('createdById', 'name username role')
      .populate('jobId', 'jobNumber status vendorId')
      .populate('jobReceiptId', 'receiptNumber receiptDate remarks')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      data: transactions,
      finishedGoods: fg,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching finished goods transactions' });
  }
};
