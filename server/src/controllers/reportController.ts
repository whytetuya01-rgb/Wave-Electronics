import { Response } from 'express';
import mongoose from 'mongoose';
import { Component } from '../models/Component.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { Job } from '../models/Job.js';
import { Vendor } from '../models/Vendor.js';
import { computeJobReconciliation } from './jobReceiptController.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * 1. Component Stock Report
 * Comprehensive inventory valuation, store balance, reservations, and vendor floor stock.
 */
export const getComponentStockReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryId, status, search } = req.query;

    const query: Record<string, any> = { isActive: true };

    if (categoryId && typeof categoryId === 'string' && mongoose.Types.ObjectId.isValid(categoryId)) {
      query.categoryId = categoryId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ partCode: searchRegex }, { name: searchRegex }, { package: searchRegex }];
    }

    const components = await Component.find(query)
      .populate('categoryId', 'name')
      .populate('unitId', 'name symbol')
      .populate('locationId', 'name code')
      .sort({ partCode: 1 })
      .lean();

    // Map calculated metrics
    const mapped = components.map((c) => {
      const inStore = c.inStoreStock || 0;
      const reserved = c.reservedStock || 0;
      const available = Math.max(0, inStore - reserved);
      const withVendor = c.withVendorStock || 0;
      const rate = c.ratePerUnit || 0;
      const minStock = c.minStock || 0;

      let stockHealth: 'healthy' | 'low_stock' | 'out_of_stock' = 'healthy';
      if (available === 0 && inStore === 0) {
        stockHealth = 'out_of_stock';
      } else if (available <= minStock) {
        stockHealth = 'low_stock';
      }

      return {
        _id: c._id,
        partCode: c.partCode,
        name: c.name,
        category: (c.categoryId as any)?.name || 'Uncategorized',
        unit: (c.unitId as any)?.symbol || 'pcs',
        location: (c.locationId as any)?.name || 'Main Warehouse',
        package: c.package || '-',
        inStoreStock: inStore,
        reservedStock: reserved,
        availableStock: available,
        withVendorStock: withVendor,
        totalPhysicalStock: inStore,
        minStock,
        ratePerUnit: rate,
        storeValuation: inStore * rate,
        availableValuation: available * rate,
        withVendorValuation: withVendor * rate,
        totalValuation: (inStore + withVendor) * rate,
        stockHealth,
      };
    });

    // Apply status filter if provided
    const filtered = status && status !== 'all'
      ? mapped.filter((item) => {
          if (status === 'out_of_stock') return item.stockHealth === 'out_of_stock';
          if (status === 'low_stock') return item.stockHealth === 'low_stock';
          if (status === 'with_vendors') return item.withVendorStock > 0;
          if (status === 'healthy') return item.stockHealth === 'healthy';
          return true;
        })
      : mapped;

    // Calculate aggregated totals across the filtered dataset
    const summary = filtered.reduce(
      (acc, item) => {
        acc.totalComponents += 1;
        acc.totalInStoreStock += item.inStoreStock;
        acc.totalReservedStock += item.reservedStock;
        acc.totalAvailableStock += item.availableStock;
        acc.totalWithVendorStock += item.withVendorStock;
        acc.totalStoreValuation += item.storeValuation;
        acc.totalWithVendorValuation += item.withVendorValuation;
        acc.totalInventoryValuation += item.totalValuation;
        if (item.stockHealth === 'low_stock') acc.lowStockCount += 1;
        if (item.stockHealth === 'out_of_stock') acc.outOfStockCount += 1;
        return acc;
      },
      {
        totalComponents: 0,
        totalInStoreStock: 0,
        totalReservedStock: 0,
        totalAvailableStock: 0,
        totalWithVendorStock: 0,
        totalStoreValuation: 0,
        totalWithVendorValuation: 0,
        totalInventoryValuation: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      }
    );

    res.json({
      data: filtered,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating component stock report' });
  }
};

/**
 * 2. Low Stock Alert Report
 * Focuses strictly on components below or at minStock threshold, calculating deficits and reorder costs.
 */
export const getLowStockReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryId, search } = req.query;

    const query: Record<string, any> = { isActive: true };

    if (categoryId && typeof categoryId === 'string' && mongoose.Types.ObjectId.isValid(categoryId)) {
      query.categoryId = categoryId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ partCode: searchRegex }, { name: searchRegex }, { package: searchRegex }];
    }

    const components = await Component.find(query)
      .populate('categoryId', 'name')
      .populate('unitId', 'name symbol')
      .populate('locationId', 'name code')
      .sort({ partCode: 1 })
      .lean();

    const lowStockItems: any[] = [];
    let criticalCount = 0;
    let totalDeficit = 0;
    let totalReorderCost = 0;

    components.forEach((c) => {
      const inStore = c.inStoreStock || 0;
      const reserved = c.reservedStock || 0;
      const available = Math.max(0, inStore - reserved);
      const minStock = c.minStock || 0;
      const rate = c.ratePerUnit || 0;

      if (available <= minStock) {
        const deficit = Math.max(0, minStock - available);
        const reorderCost = deficit * rate;

        if (available === 0) criticalCount++;
        totalDeficit += deficit;
        totalReorderCost += reorderCost;

        lowStockItems.push({
          _id: c._id,
          partCode: c.partCode,
          name: c.name,
          category: (c.categoryId as any)?.name || 'General',
          unit: (c.unitId as any)?.symbol || 'pcs',
          location: (c.locationId as any)?.name || 'Store',
          package: c.package || '-',
          inStoreStock: inStore,
          reservedStock: reserved,
          availableStock: available,
          withVendorStock: c.withVendorStock || 0,
          minStock,
          deficit,
          ratePerUnit: rate,
          estimatedReorderCost: reorderCost,
          isCritical: available === 0,
        });
      }
    });

    res.json({
      data: lowStockItems,
      summary: {
        totalLowStockItems: lowStockItems.length,
        criticalOutOfStockCount: criticalCount,
        totalDeficitUnits: totalDeficit,
        totalReorderCost,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating low stock report' });
  }
};

/**
 * 3. Stock Movement Ledger Report
 * Complete audit trail of inventory transactions: Inward, Reserve, Release, Issue, Consumption, Return, Damage.
 */
export const getStockLedgerReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { componentId, type, startDate, endDate, search, limit = '200' } = req.query;

    const query: Record<string, any> = {};

    if (componentId && typeof componentId === 'string' && mongoose.Types.ObjectId.isValid(componentId)) {
      query.componentId = componentId;
    }

    if (type && typeof type === 'string' && type !== 'all') {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.referenceNo = new RegExp(search.trim(), 'i');
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 200, 500);

    const transactions = await StockTransaction.find(query)
      .populate('componentId', 'partCode name ratePerUnit unitId')
      .populate('vendorId', 'name code')
      .populate('createdById', 'name username')
      .sort({ createdAt: -1 })
      .limit(maxLimit)
      .lean();

    // Summary breakdown by transaction type
    const typeSummary: Record<string, number> = {};
    transactions.forEach((tx) => {
      typeSummary[tx.type] = (typeSummary[tx.type] || 0) + 1;
    });

    res.json({
      data: transactions,
      summary: {
        totalTransactions: transactions.length,
        typeSummary,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating stock ledger report' });
  }
};

/**
 * 4. Material With Vendors Report
 * Detailed breakdown of raw components currently held on vendor assembly lines.
 */
export const getMaterialWithVendorsReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorId } = req.query;

    // Authoritative source: components with withVendorStock > 0
    const componentsWithVendors = await Component.find({
      isActive: true,
      withVendorStock: { $gt: 0 },
    })
      .populate('categoryId', 'name')
      .populate('unitId', 'symbol')
      .sort({ partCode: 1 })
      .lean();

    // Cross-reference active jobs (issued or partially_received) to attribute material to specific vendors
    const activeJobsQuery: Record<string, any> = {
      status: { $in: ['issued', 'partially_received'] },
    };

    if (vendorId && typeof vendorId === 'string' && mongoose.Types.ObjectId.isValid(vendorId)) {
      activeJobsQuery.vendorId = vendorId;
    }

    const activeJobs = await Job.find(activeJobsQuery)
      .populate('vendorId', 'name code phone email')
      .lean();

    // Map materials held across active jobs per vendor
    const vendorMap: Map<string, any> = new Map();

    activeJobs.forEach((job) => {
      const v = job.vendorId as any;
      if (!v) return;
      const vId = v._id.toString();

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: vId,
          vendorName: v.name,
          vendorCode: v.code,
          phone: v.phone || '-',
          email: v.email || '-',
          activeJobs: [],
          components: new Map<string, any>(),
          totalItemsCount: 0,
          totalValuation: 0,
        });
      }

      const vEntry = vendorMap.get(vId)!;
      vEntry.activeJobs.push({
        _id: job._id,
        jobNumber: job.jobNumber,
        status: job.status,
        issuedDate: job.updatedAt,
      });

      // Aggregate issued components for this job
      (job.jobCircuits || []).forEach((jc: any) => {
        // Find requirements if snapshot exists
      });
    });

    // Summary of total with-vendor stock from components collection (authoritative ground truth)
    const componentRows = componentsWithVendors.map((c) => ({
      _id: c._id,
      partCode: c.partCode,
      name: c.name,
      category: (c.categoryId as any)?.name || 'General',
      unit: (c.unitId as any)?.symbol || 'pcs',
      withVendorStock: c.withVendorStock,
      ratePerUnit: c.ratePerUnit || 0,
      valuation: (c.withVendorStock || 0) * (c.ratePerUnit || 0),
    }));

    const totalValuation = componentRows.reduce((sum, c) => sum + c.valuation, 0);
    const totalUnits = componentRows.reduce((sum, c) => sum + c.withVendorStock, 0);

    const vendorsList = await Vendor.find({ isActive: true }).select('name code phone email').lean();

    res.json({
      componentsWithVendors: componentRows,
      activeJobsWithVendors: Array.from(vendorMap.values()),
      vendorsList,
      summary: {
        totalComponentsWithVendors: componentRows.length,
        totalUnitsWithVendors: totalUnits,
        totalValuationWithVendors: totalValuation,
        activeJobsHoldingMaterial: activeJobs.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating material with vendors report' });
  }
};

/**
 * 5. Pending Job Receipts Report
 * Tracks manufacturing jobs currently in progress at assemblers with pending circuit receipt quantities.
 */
export const getPendingJobReceiptsReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorId, search } = req.query;

    const query: Record<string, any> = {
      status: { $in: ['issued', 'partially_received', 'approved'] },
    };

    if (vendorId && typeof vendorId === 'string' && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.jobNumber = new RegExp(search.trim(), 'i');
    }

    const jobs = await Job.find(query)
      .populate('vendorId', 'name code')
      .populate('jobCircuits.circuitId', 'name circuitCode')
      .sort({ createdAt: -1 })
      .lean();

    let totalTargetCircuits = 0;
    let totalCompletedGood = 0;
    let totalRejected = 0;
    let totalPendingCircuits = 0;
    let overdueJobsCount = 0;

    const now = new Date();

    const pendingJobsData = jobs.map((job) => {
      let jobTarget = 0;
      let jobGood = 0;
      let jobRejected = 0;

      const circuits = (job.jobCircuits || []).map((jc: any) => {
        const ordered = jc.orderedQty || 0;
        const good = jc.completedGoodQty || 0;
        const rejected = jc.rejectedQty || 0;
        const pending = Math.max(0, ordered - (good + rejected));

        jobTarget += ordered;
        jobGood += good;
        jobRejected += rejected;

        return {
          circuitId: jc.circuitId?._id || jc.circuitId,
          circuitCode: jc.circuitCode,
          circuitName: jc.circuitName,
          circuitVersion: jc.circuitVersion,
          orderedQty: ordered,
          completedGoodQty: good,
          rejectedQty: rejected,
          pendingQty: pending,
          progressPercent: ordered > 0 ? Math.min(100, Math.round((good / ordered) * 100)) : 0,
        };
      });

      const jobPending = Math.max(0, jobTarget - (jobGood + jobRejected));
      totalTargetCircuits += jobTarget;
      totalCompletedGood += jobGood;
      totalRejected += jobRejected;
      totalPendingCircuits += jobPending;

      const dueDate = job.deliveryDueDate ? new Date(job.deliveryDueDate) : null;
      const isOverdue = dueDate ? dueDate < now && jobPending > 0 : false;
      if (isOverdue) overdueJobsCount++;

      return {
        _id: job._id,
        jobNumber: job.jobNumber,
        vendor: (job.vendorId as any)?.name || 'Unknown Vendor',
        vendorCode: (job.vendorId as any)?.code || '-',
        status: job.status,
        issuedDate: job.approvedAt || job.createdAt,
        deliveryDueDate: job.deliveryDueDate || null,
        isOverdue,
        totalTarget: jobTarget,
        totalGood: jobGood,
        totalRejected: jobRejected,
        totalPending: jobPending,
        overallProgress: jobTarget > 0 ? Math.min(100, Math.round((jobGood / jobTarget) * 100)) : 0,
        circuits,
      };
    });

    res.json({
      data: pendingJobsData,
      summary: {
        totalPendingJobs: pendingJobsData.length,
        totalTargetCircuits,
        totalCompletedGood,
        totalRejected,
        totalPendingCircuits,
        overdueJobsCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating pending job receipts report' });
  }
};

/**
 * 6. Job Reconciliation Report
 * High-level list of jobs with reconciliation statuses, plus single job breakdown via computeJobReconciliation.
 */
export const getJobReconciliationReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, vendorId, search, limit = '50' } = req.query;

    const query: Record<string, any> = {};

    if (status && typeof status === 'string' && status !== 'all') {
      query.status = status;
    } else {
      // Default to closed, short_closed, or jobs with receipts
      query.status = { $in: ['closed', 'short_closed', 'partially_received', 'issued'] };
    }

    if (vendorId && typeof vendorId === 'string' && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.jobNumber = new RegExp(search.trim(), 'i');
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    const jobs = await Job.find(query)
      .populate('vendorId', 'name code')
      .sort({ updatedAt: -1 })
      .limit(maxLimit)
      .lean();

    const jobsSummary = jobs.map((j) => {
      const isReconciled = j.status === 'closed' || j.status === 'short_closed';
      return {
        _id: j._id,
        jobNumber: j.jobNumber,
        vendorName: (j.vendorId as any)?.name || '-',
        status: j.status,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        hasCloseSnapshot: Boolean(j.closeReconciliationSnapshot),
        isReconciled,
        circuitsCount: (j.jobCircuits || []).length,
      };
    });

    const closedCount = jobs.filter((j) => j.status === 'closed').length;
    const shortClosedCount = jobs.filter((j) => j.status === 'short_closed').length;
    const inProgressCount = jobs.filter((j) => j.status === 'partially_received' || j.status === 'issued').length;

    res.json({
      data: jobsSummary,
      summary: {
        totalJobs: jobs.length,
        closedCount,
        shortClosedCount,
        inProgressCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating job reconciliation report' });
  }
};

/**
 * 6b. Single Job Reconciliation Detail
 * Reuses existing authoritative computeJobReconciliation service.
 */
export const getSingleJobReconciliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id).lean();

    if (!job) {
      res.status(404).json({ message: 'Job not found' });
      return;
    }

    // If job was closed and snapshot exists, return snapshot; otherwise compute live
    let reconciliation: any = (job as any).closeReconciliationSnapshot;
    if (!reconciliation) {
      reconciliation = await computeJobReconciliation(job as any);
    }

    res.json({
      data: {
        job: {
          _id: job._id,
          jobNumber: job.jobNumber,
          status: job.status,
          vendorId: job.vendorId,
          createdAt: job.createdAt,
        },
        reconciliation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching single job reconciliation' });
  }
};
