import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJobReceiptCircuitLine {
  jobCircuitId: Types.ObjectId; // references Job.jobCircuits[]._id
  circuitId: Types.ObjectId;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  orderedQty: number; // snapshot
  previouslyGoodQty: number;
  previouslyRejectedQty: number;
  goodQty: number; // this event
  rejectedQty: number; // this event
  rejectionReason?: string;
  cumulativeAfter: number; // previouslyGood+previouslyRejected+goodQty+rejectedQty
}

export interface IJobReceiptConsumptionLine {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  qtyConsumed: number; // derived: this event's (good+rejected) x historical BOM qtyPerUnit, aggregated per component
}

export interface IJobReceiptReturnLine {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  challanId: Types.ObjectId;
  challanNumber: string;
  receivedQty: number;
  damagedQty: number;
}

export interface IJobReceipt extends Document {
  receiptNumber: string;
  receiptDate: Date;
  jobId: Types.ObjectId;
  jobNumber: string;
  vendorId: Types.ObjectId;
  vendorRefNumber?: string; // vendor's own delivery/reference number
  circuitReceipts: IJobReceiptCircuitLine[];
  consumption: IJobReceiptConsumptionLine[];
  componentReturns: IJobReceiptReturnLine[];
  remarks?: string;
  idempotencyKey: string;
  receivedById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobReceiptCircuitLineSchema = new Schema<IJobReceiptCircuitLine>(
  {
    jobCircuitId: { type: Schema.Types.ObjectId, required: true },
    circuitId: { type: Schema.Types.ObjectId, ref: 'Circuit', required: true },
    circuitCode: { type: String, required: true },
    circuitName: { type: String, required: true },
    circuitVersion: { type: String, required: true },
    orderedQty: { type: Number, required: true, min: 0 },
    previouslyGoodQty: { type: Number, required: true, min: 0 },
    previouslyRejectedQty: { type: Number, required: true, min: 0 },
    goodQty: { type: Number, required: true, min: 0 },
    rejectedQty: { type: Number, required: true, min: 0 },
    rejectionReason: { type: String, trim: true },
    cumulativeAfter: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const JobReceiptConsumptionLineSchema = new Schema<IJobReceiptConsumptionLine>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    qtyConsumed: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const JobReceiptReturnLineSchema = new Schema<IJobReceiptReturnLine>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    challanId: { type: Schema.Types.ObjectId, ref: 'DeliveryChallan', required: true },
    challanNumber: { type: String, required: true },
    receivedQty: { type: Number, default: 0, min: 0 },
    damagedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const JobReceiptSchema = new Schema<IJobReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    receiptDate: { type: Date, default: Date.now, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    jobNumber: { type: String, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorRefNumber: { type: String, trim: true },
    circuitReceipts: { type: [JobReceiptCircuitLineSchema], default: [] },
    consumption: { type: [JobReceiptConsumptionLineSchema], default: [] },
    componentReturns: { type: [JobReceiptReturnLineSchema], default: [] },
    remarks: { type: String, trim: true },
    idempotencyKey: { type: String, required: true, unique: true },
    receivedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const JobReceipt = mongoose.model<IJobReceipt>('JobReceipt', JobReceiptSchema);
