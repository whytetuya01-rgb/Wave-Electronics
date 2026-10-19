import { Router } from 'express';
import {
  getComponentStockReport,
  getLowStockReport,
  getStockLedgerReport,
  getMaterialWithVendorsReport,
  getPendingJobReceiptsReport,
  getJobReconciliationReport,
  getSingleJobReconciliation,
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/component-stock', authenticate, getComponentStockReport);
router.get('/low-stock', authenticate, getLowStockReport);
router.get('/stock-ledger', authenticate, getStockLedgerReport);
router.get('/material-with-vendors', authenticate, getMaterialWithVendorsReport);
router.get('/pending-jobs', authenticate, getPendingJobReceiptsReport);
router.get('/job-reconciliation', authenticate, getJobReconciliationReport);
router.get('/job-reconciliation/:id', authenticate, getSingleJobReconciliation);

export default router;
