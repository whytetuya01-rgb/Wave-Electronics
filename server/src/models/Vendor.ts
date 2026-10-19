import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVendorCircuitRate {
  circuitName: string;
  ratePerUnit: number;
}

export interface IVendor extends Document {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city: string;
  state?: string;
  circuitsCanAssemble: string[];
  vendorCircuitRates: IVendorCircuitRate[];
  defaultJobWorkRate: number;
  remarks?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VendorCircuitRateSchema = new Schema<IVendorCircuitRate>(
  {
    circuitName: { type: String, required: true, trim: true },
    ratePerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const VendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    address: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: 'Maharashtra' },
    circuitsCanAssemble: [{ type: String, trim: true }],
    vendorCircuitRates: [VendorCircuitRateSchema],
    defaultJobWorkRate: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);
