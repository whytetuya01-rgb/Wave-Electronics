import mongoose, { Schema, Document } from 'mongoose';

export type ActivityModule =
  | 'auth'
  | 'component'
  | 'vendor'
  | 'stock_inward'
  | 'circuit'
  | 'job'
  | 'job_receipt'
  | 'finished_goods'
  | 'settings';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  action: string;
  module: ActivityModule;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    module: {
      type: String,
      enum: [
        'auth',
        'component',
        'vendor',
        'stock_inward',
        'circuit',
        'job',
        'job_receipt',
        'finished_goods',
        'settings',
      ],
      required: true,
    },
    targetId: { type: String },
    targetLabel: { type: String },
    details: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ module: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
