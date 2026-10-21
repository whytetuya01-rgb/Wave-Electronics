import { Router } from 'express';
import {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  adjustStock,
  deleteComponent,
  bulkImportComponents,
} from '../controllers/componentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getComponents);
router.post('/bulk-import', authenticate, authorize(['admin', 'store_keeper']), bulkImportComponents);
router.get('/:id', authenticate, getComponentById);
router.post('/', authenticate, authorize(['admin', 'store_keeper']), createComponent);
router.put('/:id', authenticate, authorize(['admin', 'store_keeper']), updateComponent);
router.post('/:id/adjust', authenticate, authorize(['admin', 'store_keeper']), adjustStock);
router.delete('/:id', authenticate, authorize(['admin']), deleteComponent);

export default router;
