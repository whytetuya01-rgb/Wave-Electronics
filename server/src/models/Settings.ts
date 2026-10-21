import mongoose, { Schema, Document } from 'mongoose';

// Singleton settings document - always read/written by the fixed id
// 'global'. Holds only the subset of Module 12 "Settings" that is safe to
// make admin-editable without touching stock-integrity logic: company
// identity used on generated PDFs. Document-number prefixes remain
// hardcoded in each controller's sequence key (JOB-, CHL-, INW-, JRC-) -
// making those configurable was deliberately deferred rather than risking
// the numbering system on delivery day.
export interface ISettings extends Omit<Document, '_id'> {
  _id: string;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  logoPath?: string;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    _id: { type: String, default: 'global' },
    companyName: { type: String, required: true, trim: true, default: 'Wave Electronics' },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    gstin: { type: String, trim: true },
    logoPath: { type: String, trim: true },
  },
  { timestamps: { createdAt: false, updatedAt: true }, _id: false }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);

// Returns the singleton settings document, creating it with defaults on
// first access so callers never have to null-check.
export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findById('global');
  if (!settings) {
    settings = await Settings.create({ _id: 'global', companyName: 'Wave Electronics' });
  }
  return settings;
}
