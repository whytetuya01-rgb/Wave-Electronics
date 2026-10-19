import { Router } from 'express';
import { getJobs, getJobById, createJob, updateJob, approveJob, issueMaterial, cancelJob, closeJob } from '../controllers/jobController.js';
import { receiveJobMaterial, getJobReceiptsByJob, getJobReconciliation } from '../controllers/jobReceiptController.js';
import { getJobReceiptPdf } from '../controllers/pdfController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { jobIdParamSchema, materialIssueBodySchema, jobReceiptBodySchema } from '../schemas/jobSchemas.js';

const router = Router();

router.get('/', authenticate, getJobs);
router.get('/:id', authenticate, getJobById);
router.get('/:id/reconciliation', authenticate, getJobReconciliation);
router.get('/:id/receipts', authenticate, getJobReceiptsByJob);
router.get('/:id/receipts/:receiptId/pdf', authenticate, getJobReceiptPdf);
router.post('/', authenticate, authorize(['admin', 'production']), createJob);
router.put('/:id', authenticate, authorize(['admin', 'production']), updateJob);
router.post('/:id/approve', authenticate, authorize(['admin']), validate(jobIdParamSchema, 'params'), approveJob);
router.post('/:id/issue', authenticate, authorize(['admin', 'store_keeper']), validate(materialIssueBodySchema, 'body'), issueMaterial);
router.post('/:id/receipts', authenticate, authorize(['admin', 'store_keeper']), validate(jobReceiptBodySchema, 'body'), receiveJobMaterial);
router.post('/:id/close', authenticate, authorize(['admin']), closeJob);
router.post('/:id/cancel', authenticate, authorize(['admin', 'production']), cancelJob);

export default router;
