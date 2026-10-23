import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/mastersController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Categories
router.get('/categories', authenticate, getCategories);
router.post('/categories', authenticate, authorize(['admin', 'store_keeper']), createCategory);
router.put('/categories/:id', authenticate, authorize(['admin', 'store_keeper']), updateCategory);
router.delete('/categories/:id', authenticate, authorize(['admin']), deleteCategory);

// Units
router.get('/units', authenticate, getUnits);
router.post('/units', authenticate, authorize(['admin', 'store_keeper']), createUnit);
router.put('/units/:id', authenticate, authorize(['admin', 'store_keeper']), updateUnit);
router.delete('/units/:id', authenticate, authorize(['admin']), deleteUnit);

// Locations
router.get('/locations', authenticate, getLocations);
router.post('/locations', authenticate, authorize(['admin', 'store_keeper']), createLocation);
router.put('/locations/:id', authenticate, authorize(['admin', 'store_keeper']), updateLocation);
router.delete('/locations/:id', authenticate, authorize(['admin']), deleteLocation);

export default router;
