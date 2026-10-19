import mongoose, { Schema, Document, Types } from 'mongoose';

export type JobStatus = 'draft' | 'approved' | 'material_issued' | 'partially_received' | 'closed' | 'cancelled';

export interface IJobBomSnapshotItem {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  qtyPerUnit: number;
  unitRate: number;
  designator?: string;
}

export interface IJobCircuit {
  _id?: Types.ObjectId;
  circuitId: Types.ObjectId;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  orderedQty: number;
  bomSnapshot: IJobBomSnapshotItem[];
  estimatedMaterialCost: number;
  // Cumulative finished-circuit receipt tracking for THIS job circuit line,
  // written only by JobReceipt. receivedGoodQty + receivedRejectedQty must
  // never exceed orderedQty (atomically guarded at receipt time).
  receivedGoodQty: number;
  receivedRejectedQty: number;
}

export interface IJobMaterialRequirement {
  componentId: Types.ObjectId;
  partCode: string;
  name: string;
  requiredQty: number;
  unitRate: number;
  totalCost: number;
  // Per-job commitments against this requirement - untouched by Draft
  // creation/editing, written only once Approval (reservedQty) and Material
  // Issue (issuedQty) exist. Distinct from the component's own global
  // reservedStock, which reflects reservations across ALL jobs.
  reservedQty: number;
  issuedQty: number;
  // Job-level reconciliation counters, aggregated across every challan and
  // job receipt for this job (component-level return/damage is also tracked
  // per-challan on DeliveryChallan.items for document-level accuracy, but
  // these are the authoritative job-wide totals used for reconciliation and
  // close-eligibility). consumedQty is BOM-derived: (goodQty + rejectedQty)
  // x historical qtyPerUnit, written when finished circuits are received.
  returnedQty: number;
  damagedQty: number;
  consumedQty: number;
}

export interface IJob extends Document {
  jobNumber: string;
  jobDate: Date;
  vendorId: Types.ObjectId;
  targetDate: Date;
  remarks?: string;
  status: JobStatus;
  jobCircuits: IJobCircuit[];
  materialRequirement: IJobMaterialRequirement[];
  totalEstimatedCost: number;
  createdById: Types.ObjectId;
  updatedById?: Types.ObjectId;
  approvedById?: Types.ObjectId;
  approvedAt?: Date;
  cancelledById?: Types.ObjectId;
  cancelledAt?: Date;
  closedById?: Types.ObjectId;
  closedAt?: Date;
  isShortClosed?: boolean;
  closeReason?: string;
  // Immutable snapshot of the reconciliation computation at the moment of
  // closing (normal or short), so the audit record survives even if later
  // component rate changes etc. would otherwise alter a live recomputation.
  closeReconciliationSnapshot?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const JobBomSnapshotItemSchema = new Schema<IJobBomSnapshotItem>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    qtyPerUnit: { type: Number, required: true },
    unitRate: { type: Number, required: true },
    designator: { type: String },
  },
  { _id: false }
);

const JobCircuitSchema = new Schema<IJobCircuit>(
  {
    circuitId: { type: Schema.Types.ObjectId, ref: 'Circuit', required: true },
    circuitCode: { type: String, required: true },
    circuitName: { type: String, required: true },
    circuitVersion: { type: String, required: true },
    orderedQty: { type: Number, required: true, min: 0.0001 },
    bomSnapshot: { type: [JobBomSnapshotItemSchema], required: true },
    estimatedMaterialCost: { type: Number, required: true, min: 0 },
    receivedGoodQty: { type: Number, default: 0, min: 0 },
    receivedRejectedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const JobMaterialRequirementSchema = new Schema<IJobMaterialRequirement>(
  {
    componentId: { type: Schema.Types.ObjectId, ref: 'Component', required: true },
    partCode: { type: String, required: true },
    name: { type: String, required: true },
    requiredQty: { type: Number, required: true, min: 0 },
    unitRate: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
    issuedQty: { type: Number, default: 0, min: 0 },
    returnedQty: { type: Number, default: 0, min: 0 },
    damagedQty: { type: Number, default: 0, min: 0 },
    consumedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const JobSchema = new Schema<IJob>(
  {
    jobNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    jobDate: { type: Date, default: Date.now, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    targetDate: { type: Date, required: true },
    remarks: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'approved', 'material_issued', 'partially_received', 'closed', 'cancelled'],
      default: 'draft',
      required: true,
      index: true,
    },
    jobCircuits: {
      type: [JobCircuitSchema],
      validate: {
        validator: (items: IJobCircuit[]) => Array.isArray(items) && items.length > 0,
        message: 'Job must include at least one circuit',
      },
    },
    materialRequirement: { type: [JobMaterialRequirementSchema], default: [] },
    totalEstimatedCost: { type: Number, required: true, default: 0, min: 0 },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    cancelledById: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    closedById: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    isShortClosed: { type: Boolean, default: false },
    closeReason: { type: String, trim: true },
    closeReconciliationSnapshot: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJob>('Job', JobSchema);
