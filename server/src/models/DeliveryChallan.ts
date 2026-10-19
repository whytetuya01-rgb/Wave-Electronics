import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeliveryChallanItem {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  issuedQty: number;
  // Cumulative across all receipt events against this challan line. Remaining
  // receivable is always issuedQty - receivedQty - damagedQty - no separate
  // stored field, so it can never drift out of sync with the receipt history.
  receivedQty: number;
  damagedQty: number;
}

export interface IDeliveryChallan extends Document {
  challanNumber: string;
  challanDate: Date;
  jobId: Types.ObjectId;
  jobNumber: string;
  vendorId: Types.ObjectId;
  // Vendor details snapshotted at issue time, for a stable printable record
  // independent of later edits to the vendor profile.
  vendorName: string;
  vendorAddress?: string;
  vendorCity?: string;
  vendorGstNumber?: string;
  items: IDeliveryChallanItem[];
  totalItems: number;
  totalQty: number;
  status: 'issued' | 'partially_received' | 'received';
  // Dedupes retried/concurrent issue requests - see performMaterialIssue.
  idempotencyKey: string;
  issuedById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryChallanItemSchema = new Schema<IDeliveryChallanItem>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    issuedQty: { type: Number, required: true, min: 0.0001 },
    receivedQty: { type: Number, default: 0, min: 0 },
    damagedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const DeliveryChallanSchema = new Schema<IDeliveryChallan>(
  {
    challanNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    challanDate: { type: Date, default: Date.now, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    jobNumber: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true },
    vendorAddress: { type: String },
    vendorCity: { type: String },
    vendorGstNumber: { type: String },
    items: {
      type: [DeliveryChallanItemSchema],
      validate: {
        validator: (items: IDeliveryChallanItem[]) => Array.isArray(items) && items.length > 0,
        message: 'A delivery challan must contain at least one issued component',
      },
    },
    totalItems: { type: Number, required: true, min: 1 },
    totalQty: { type: Number, required: true, min: 0.0001 },
    status: { type: String, enum: ['issued', 'partially_received', 'received'], default: 'issued', required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    issuedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const DeliveryChallan = mongoose.model<IDeliveryChallan>('DeliveryChallan', DeliveryChallanSchema);
