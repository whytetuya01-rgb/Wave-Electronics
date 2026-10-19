import { Router } from 'express';
import { getChallansByJob, getChallanById } from '../controllers/challanController.js';
import { receiveMaterial, getReceiptsByChallan, getReceiptsByJob } from '../controllers/receiptController.js';
import { getChallanPdf } from '../controllers/pdfController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/job/:jobId', authenticate, getChallansByJob);
router.get('/job/:jobId/receipts', authenticate, getReceiptsByJob);
router.get('/:id', authenticate, getChallanById);
router.get('/:id/pdf', authenticate, getChallanPdf);
router.get('/:challanId/receipts', authenticate, getReceiptsByChallan);
router.post('/:id/receive', authenticate, authorize(['admin', 'store_keeper']), receiveMaterial);

export default router;
