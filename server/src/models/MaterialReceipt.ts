import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMaterialReceiptItem {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  // Snapshots of the challan line's state at the moment of THIS receipt
  // event, for a self-contained audit record independent of the challan's
  // later (further-updated) cumulative totals.
  issuedQty: number;
  previouslyReceivedQty: number;
  previouslyDamagedQty: number;
  receivedQty: number; // this event's good/usable qty, returned to store
  damagedQty: number; // this event's damaged/lost qty, written off
  remainingAfter: number;
}

export interface IMaterialReceipt extends Document {
  receiptNumber: string;
  receiptDate: Date;
  challanId: Types.ObjectId;
  challanNumber: string;
  jobId: Types.ObjectId;
  jobNumber: string;
  vendorId: Types.ObjectId;
  items: IMaterialReceiptItem[];
  totalItems: number;
  totalReceivedQty: number;
  totalDamagedQty: number;
  notes?: string;
  idempotencyKey: string;
  receivedById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialReceiptItemSchema = new Schema<IMaterialReceiptItem>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    issuedQty: { type: Number, required: true, min: 0 },
    previouslyReceivedQty: { type: Number, required: true, min: 0 },
    previouslyDamagedQty: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, required: true, min: 0 },
    damagedQty: { type: Number, required: true, min: 0 },
    remainingAfter: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MaterialReceiptSchema = new Schema<IMaterialReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    receiptDate: { type: Date, default: Date.now, required: true },
    challanId: { type: Schema.Types.ObjectId, ref: 'DeliveryChallan', required: true, index: true },
    challanNumber: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    jobNumber: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    items: {
      type: [MaterialReceiptItemSchema],
      validate: {
        validator: (items: IMaterialReceiptItem[]) => Array.isArray(items) && items.length > 0,
        message: 'A material receipt must contain at least one component line',
      },
    },
    totalItems: { type: Number, required: true, min: 1 },
    totalReceivedQty: { type: Number, required: true, min: 0 },
    totalDamagedQty: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    idempotencyKey: { type: String, required: true, unique: true },
    receivedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const MaterialReceipt = mongoose.model<IMaterialReceipt>('MaterialReceipt', MaterialReceiptSchema);
