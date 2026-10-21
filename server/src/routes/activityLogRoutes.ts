import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityLogController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize(['admin']), getActivityLogs);

export default router;
