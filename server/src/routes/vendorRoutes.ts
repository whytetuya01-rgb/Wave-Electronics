import { Router } from 'express';
import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  toggleVendorStatus,
  deleteVendor,
} from '../controllers/vendorController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getVendors);
router.get('/:id', authenticate, getVendorById);
router.post('/', authenticate, authorize(['admin', 'production']), createVendor);
router.put('/:id', authenticate, authorize(['admin', 'production']), updateVendor);
router.patch('/:id/toggle-status', authenticate, authorize(['admin', 'production']), toggleVendorStatus);
router.delete('/:id', authenticate, authorize(['admin']), deleteVendor);

export default router;
