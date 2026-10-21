import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog.js';
import { AuthRequest } from '../middleware/auth.js';

export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, module, from, to, page = '1', limit = '50' } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (module) filter.module = module;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      data: logs,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error fetching activity logs' });
  }
};
