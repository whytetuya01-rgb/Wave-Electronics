import { Response } from 'express';
import { Settings, getSettings } from '../models/Settings.js';
import { AuthRequest } from '../middleware/auth.js';
import { logActivity } from '../services/activityLog.js';

export const getSettingsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getSettings();
    res.json({ data: settings });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error fetching settings' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, address, phone, email, gstin, logoPath } = req.body;

    if (!companyName || !companyName.trim()) {
      res.status(400).json({ message: 'Company name is required' });
      return;
    }

    const settings = await Settings.findByIdAndUpdate(
      'global',
      { companyName, address, phone, email, gstin, logoPath },
      { new: true, upsert: true }
    );

    logActivity({
      userId: String(req.user!._id),
      userName: req.user!.name,
      action: 'Updated company settings',
      module: 'settings',
      targetId: 'global',
      targetLabel: 'Company Settings',
    });

    res.json({ message: 'Settings updated successfully', data: settings });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error updating settings' });
  }
};
