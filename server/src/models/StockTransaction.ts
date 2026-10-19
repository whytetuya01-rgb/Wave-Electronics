import mongoose, { Schema, Document, Types } from 'mongoose';

export type TransactionType =
  | 'OPENING'
  | 'INWARD'
  | 'RESERVE'
  | 'UNRESERVE'
  | 'ISSUE_TO_VENDOR'
  | 'RETURN_FROM_VENDOR'
  | 'CONSUMPTION'
  | 'CIRCUIT_CONSUMPTION'
  | 'ADJUSTMENT';

export type ReferenceType = 'JOB' | 'INWARD' | 'CHALLAN' | 'RECEIPT' | 'JOB_RECEIPT' | 'ADJUSTMENT' | 'OPENING';

export interface IStockTransaction extends Document {
  componentId: Types.ObjectId;
  type: TransactionType;
  locationType: 'STORE' | 'VENDOR';
  vendorId?: Types.ObjectId;
  qtyChange: number; // Positive = stock added, Negative = stock removed
  balanceInStoreAfter: number;
  balanceReservedAfter: number;
  balanceWithVendorAfter: number;
  referenceType: ReferenceType;
  referenceId?: Types.ObjectId | string;
  referenceNo?: string;
  adjustmentReason?: 'damage' | 'count_correction' | 'lost' | 'other';
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
}

const StockTransactionSchema = new Schema<IStockTransaction>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true, index: true },
    type: {
      type: String,
      enum: [
        'OPENING',
        'INWARD',
        'RESERVE',
        'UNRESERVE',
        'ISSUE_TO_VENDOR',
        'RETURN_FROM_VENDOR',
        'CONSUMPTION',
        'CIRCUIT_CONSUMPTION',
        'ADJUSTMENT',
      ],
      required: true,
      index: true,
    },
    locationType: { type: String, enum: ['STORE', 'VENDOR'], default: 'STORE', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    qtyChange: { type: Number, required: true },
    balanceInStoreAfter: { type: Number, required: true },
    balanceReservedAfter: { type: Number, required: true, default: 0 },
    balanceWithVendorAfter: { type: Number, required: true, default: 0 },
    referenceType: {
      type: String,
      enum: ['JOB', 'INWARD', 'CHALLAN', 'RECEIPT', 'JOB_RECEIPT', 'ADJUSTMENT', 'OPENING'],
      required: true,
    },
    referenceId: { type: Schema.Types.Mixed },
    referenceNo: { type: String },
    adjustmentReason: {
      type: String,
      enum: ['damage', 'count_correction', 'lost', 'other'],
    },
    notes: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StockTransaction = mongoose.model<IStockTransaction>('StockTransaction', StockTransactionSchema);
