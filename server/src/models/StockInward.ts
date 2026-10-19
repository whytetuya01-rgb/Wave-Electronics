import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStockInwardItem {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  unitShortCode?: string;
  qty: number;
  unitRate: number;
  totalAmount: number;
  remarks?: string;
}

export interface IStockInward extends Document {
  inwardNumber: string;
  inwardDate: Date;
  supplierName: string;
  billNumber?: string;
  billDate?: Date;
  items: IStockInwardItem[];
  totalItems: number;
  totalQty: number;
  totalAmount: number;
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockInwardItemSchema = new Schema<IStockInwardItem>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    unitShortCode: { type: String, default: 'NOS' },
    qty: { type: Number, required: true, min: 1 },
    unitRate: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },
  },
  { _id: true }
);

const StockInwardSchema = new Schema<IStockInward>(
  {
    inwardNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    inwardDate: { type: Date, default: Date.now, required: true, index: true },
    supplierName: { type: String, required: true, trim: true, index: true },
    billNumber: { type: String, trim: true, index: true },
    billDate: { type: Date },
    items: [StockInwardItemSchema],
    totalItems: { type: Number, required: true, min: 1 },
    totalQty: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const StockInward = mongoose.model<IStockInward>('StockInward', StockInwardSchema);
