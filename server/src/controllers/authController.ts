import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { resolveJwtSecret } from '../config/env.js';

const generateToken = (id: string, email: string, role: string): string => {
  return jwt.sign({ id, email, role }, resolveJwtSecret(), { expiresIn: '7d' });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'User account is deactivated. Contact administrator.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id.toString(), user.email, user.role);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ message: 'User with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      isActive: true,
    });

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error creating user' });
  }
};

// Counts active admins other than the given user id. Used to block the last
// active admin from being deactivated or demoted, which would otherwise lock
// every admin-only feature (user management, job approval, settings) out of
// the system with no way back in short of a direct DB edit.
const countOtherActiveAdmins = async (excludeUserId: string): Promise<number> => {
  return User.countDocuments({
    _id: { $ne: excludeUserId },
    role: 'admin',
    isActive: true,
  });
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Prevent deactivating own account
    if (req.user?._id.toString() === id) {
      res.status(400).json({ message: 'Cannot deactivate your own account' });
      return;
    }

    const willDeactivate = user.isActive;
    if (willDeactivate && user.role === 'admin') {
      const otherActiveAdmins = await countOtherActiveAdmins(String(id));
      if (otherActiveAdmins === 0) {
        res.status(400).json({ message: 'Cannot deactivate the last active admin account' });
        return;
      }
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`, user });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error updating user' });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'store_keeper', 'production'].includes(role)) {
      res.status(400).json({ message: 'Role must be one of: admin, store_keeper, production' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (req.user?._id.toString() === id && role !== 'admin') {
      res.status(400).json({ message: 'Cannot change your own role away from admin' });
      return;
    }

    if (user.role === 'admin' && role !== 'admin' && user.isActive) {
      const otherActiveAdmins = await countOtherActiveAdmins(String(id));
      if (otherActiveAdmins === 0) {
        res.status(400).json({ message: 'Cannot change the role of the last active admin' });
        return;
      }
    }

    user.role = role;
    await user.save();

    res.json({ message: 'User role updated successfully', user: { ...user.toObject(), passwordHash: undefined } });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error updating user role' });
  }
};

export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error resetting password' });
  }
};
