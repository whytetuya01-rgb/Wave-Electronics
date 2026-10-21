import { Router } from 'express';
import {
  login,
  getMe,
  getUsers,
  createUser,
  toggleUserStatus,
  updateUserRole,
  resetUserPassword,
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize(['admin']), getUsers);
router.post('/users', authenticate, authorize(['admin']), createUser);
router.patch('/users/:id/status', authenticate, authorize(['admin']), toggleUserStatus);
router.patch('/users/:id/role', authenticate, authorize(['admin']), updateUserRole);
router.patch('/users/:id/password', authenticate, authorize(['admin']), resetUserPassword);

export default router;
