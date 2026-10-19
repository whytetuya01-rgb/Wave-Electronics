import { Router } from 'express';
import {
  getStockInwards,
  getStockInwardById,
  createStockInward,
} from '../controllers/stockInwardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getStockInwards);
router.get('/:id', authenticate, getStockInwardById);
router.post('/', authenticate, authorize(['admin', 'store_keeper']), createStockInward);

export default router;
