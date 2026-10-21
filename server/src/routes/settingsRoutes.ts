import { Router } from 'express';
import { getSettingsHandler, updateSettings } from '../controllers/settingsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize(['admin']), getSettingsHandler);
router.put('/', authenticate, authorize(['admin']), updateSettings);

export default router;
