import { Router } from 'express';
import { login, getMe, getUsers, createUser, toggleUserStatus } from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize(['admin']), getUsers);
router.post('/users', authenticate, authorize(['admin']), createUser);
router.patch('/users/:id/status', authenticate, authorize(['admin']), toggleUserStatus);

export default router;
