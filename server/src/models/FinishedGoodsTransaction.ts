import mongoose, { Schema, Document, Types } from 'mongoose';

export type FinishedGoodsTransactionType = 'received_from_job' | 'dispatched' | 'adjusted';

export interface IFinishedGoodsTransaction extends Document {
  circuitId: Types.ObjectId;
  type: FinishedGoodsTransactionType;
  qtyChange: number; // positive = added, negative = removed
  balanceAfter: number;
  jobId?: Types.ObjectId;
  jobNumber?: string;
  jobReceiptId?: Types.ObjectId;
  referenceNo?: string;
  notes?: string;
  createdById: Types.ObjectId;
  createdAt: Date;
}

const FinishedGoodsTransactionSchema = new Schema<IFinishedGoodsTransaction>(
  {
    circuitId: { type: Schema.Types.ObjectId, ref: 'Circuit', required: true, index: true },
    type: { type: String, enum: ['received_from_job', 'dispatched', 'adjusted'], required: true },
    qtyChange: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    jobNumber: { type: String },
    jobReceiptId: { type: Schema.Types.ObjectId, ref: 'JobReceipt' },
    referenceNo: { type: String },
    notes: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const FinishedGoodsTransaction = mongoose.model<IFinishedGoodsTransaction>(
  'FinishedGoodsTransaction',
  FinishedGoodsTransactionSchema
);
