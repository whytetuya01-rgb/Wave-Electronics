import { Router } from 'express';
import {
  getFinishedGoods,
  getFinishedGoodById,
  getFinishedGoodsTransactions,
} from '../controllers/finishedGoodsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getFinishedGoods);
router.get('/:id', authenticate, getFinishedGoodById);
router.get('/:id/transactions', authenticate, getFinishedGoodsTransactions);

export default router;
