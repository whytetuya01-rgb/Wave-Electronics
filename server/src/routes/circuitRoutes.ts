import { Router } from 'express';
import {
  getCircuits,
  getCircuitById,
  getCircuitAvailability,
  createCircuit,
  updateCircuit,
  toggleCircuitStatus,
  duplicateCircuit,
} from '../controllers/circuitController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getCircuits);
router.get('/:id', authenticate, getCircuitById);
router.get('/:id/availability', authenticate, getCircuitAvailability);
router.post('/', authenticate, authorize(['admin', 'production']), createCircuit);
router.put('/:id', authenticate, authorize(['admin', 'production']), updateCircuit);
router.patch('/:id/status', authenticate, authorize(['admin', 'production']), toggleCircuitStatus);
router.post('/:id/duplicate', authenticate, authorize(['admin', 'production']), duplicateCircuit);

export default router;
