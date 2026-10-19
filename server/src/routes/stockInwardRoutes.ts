import { Router } from 'express';
import {
  getStockInwards,
  getStockInwardById,
  createStockInward,
} from '../controllers/stockInwardController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createStockInwardBodySchema } from '../schemas/stockInwardSchemas.js';

const router = Router();

router.get('/', authenticate, getStockInwards);
router.get('/:id', authenticate, getStockInwardById);
router.post('/', authenticate, authorize(['admin', 'store_keeper']), validate(createStockInwardBodySchema, 'body'), createStockInward);

export default router;
