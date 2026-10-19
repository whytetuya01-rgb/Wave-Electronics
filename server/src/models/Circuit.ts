import mongoose, { Schema, Document, Types } from 'mongoose';

export type CircuitStatus = 'active' | 'inactive';

export interface ICircuitBomItem {
  _id?: Types.ObjectId;
  componentId: Types.ObjectId;
  qtyPerUnit: number;
  designator?: string;
  remarks?: string;
}

export interface ICircuit extends Document {
  circuitCode: string;
  name: string;
  version: string;
  description?: string;
  status: CircuitStatus;
  bomItems: ICircuitBomItem[];
  // Set once this exact circuit version is referenced by an approved/issued
  // job (wired up when the Jobs module lands) so its BOM can no longer be
  // edited out from under a job that already committed to it.
  isLocked: boolean;
  createdById: Types.ObjectId;
  updatedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CircuitBomItemSchema = new Schema<ICircuitBomItem>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    qtyPerUnit: { type: Number, required: true, min: 0.0001 },
    designator: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: true }
);

const CircuitSchema = new Schema<ICircuit>(
  {
    circuitCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true, default: '1.0' },
    description: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    bomItems: {
      type: [CircuitBomItemSchema],
      validate: {
        validator: (items: ICircuitBomItem[]) => Array.isArray(items) && items.length > 0,
        message: 'Circuit must have at least one BOM component',
      },
    },
    isLocked: { type: Boolean, default: false },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// A circuit code + version combination must be unique
CircuitSchema.index({ circuitCode: 1, version: 1 }, { unique: true });

export const Circuit = mongoose.model<ICircuit>('Circuit', CircuitSchema);
