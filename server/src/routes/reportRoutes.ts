import { Router } from 'express';
import {
  getComponentStockReport,
  getLowStockReport,
  getStockLedgerReport,
  getMaterialWithVendorsReport,
  getPendingJobReceiptsReport,
  getJobReconciliationReport,
  getSingleJobReconciliation,
  getVendorPerformanceReport,
  getJobConsumptionReport,
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
router.get('/vendor-performance', authenticate, getVendorPerformanceReport);
router.get('/job-consumption', authenticate, getJobConsumptionReport);

export default router;
