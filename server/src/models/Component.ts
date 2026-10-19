import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComponent extends Document {
  partCode: string;
  name: string;
  categoryId: Types.ObjectId;
  unitId: Types.ObjectId;
  locationId?: Types.ObjectId;
  package?: string; // Footprint, e.g. SMD 0805, DIP-16, TO-220
  specifications: Record<string, string>; // { value: '10k', tolerance: '1%', voltage: '50V' }
  inStoreStock: number;
  reservedStock: number;
  withVendorStock: number;
  minStock: number;
  ratePerUnit: number;
  datasheetUrl?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ComponentSchema = new Schema<IComponent>(
  {
    partCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    package: { type: String, trim: true },
    specifications: { type: Map, of: String, default: {} },
    inStoreStock: { type: Number, default: 0, min: 0 },
    reservedStock: { type: Number, default: 0, min: 0 },
    withVendorStock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    ratePerUnit: { type: Number, default: 0, min: 0 },
    datasheetUrl: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual for Available Stock = inStoreStock - reservedStock
ComponentSchema.virtual('availableStock').get(function () {
  return Math.max(0, this.inStoreStock - this.reservedStock);
});

// Ensure virtuals are serialized
ComponentSchema.set('toJSON', { virtuals: true });
ComponentSchema.set('toObject', { virtuals: true });

export const Component = mongoose.model<IComponent>('Component', ComponentSchema);
