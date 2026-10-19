import mongoose, { Schema, Document, Types } from 'mongoose';

// Finished-goods balance, tracked per specific circuit VERSION (not just
// circuit code) - this system treats every circuit version as a distinct
// identity everywhere else (BOM locking, job snapshots), so finished-goods
// balance follows the same convention: a v1.0 and v2.0 build are not
// interchangeable stock.
export interface IFinishedGoods extends Document {
  circuitId: Types.ObjectId;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  goodQtyBalance: number; // currently on hand, usable/sellable
  totalReceivedGoodQty: number; // lifetime cumulative, for reporting
  totalRejectedQty: number; // lifetime cumulative - visibility only, never adds to balance
  totalDispatchedQty: number; // reserved for a future dispatch/sales workflow - always 0 for now
  createdAt: Date;
  updatedAt: Date;
}

const FinishedGoodsSchema = new Schema<IFinishedGoods>(
  {
    circuitId: { type: Schema.Types.ObjectId, ref: 'Circuit', required: true, unique: true, index: true },
    circuitCode: { type: String, required: true },
    circuitName: { type: String, required: true },
    circuitVersion: { type: String, required: true },
    goodQtyBalance: { type: Number, default: 0, min: 0 },
    totalReceivedGoodQty: { type: Number, default: 0, min: 0 },
    totalRejectedQty: { type: Number, default: 0, min: 0 },
    totalDispatchedQty: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const FinishedGoods = mongoose.model<IFinishedGoods>('FinishedGoods', FinishedGoodsSchema);
