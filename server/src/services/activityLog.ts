import { ActivityLog, ActivityModule } from '../models/ActivityLog.js';

interface LogActivityInput {
  userId: string;
  userName: string;
  action: string;
  module: ActivityModule;
  targetId?: string;
  targetLabel?: string;
  details?: string;
}

// Writes a user-activity audit entry. Deliberately fire-and-forget and
// outside any business transaction: this is an audit trail, not inventory
// data (never confuse it with StockTransaction, the stock ledger), so a
// logging failure must never roll back or block the business operation it
// is describing.
export function logActivity(input: LogActivityInput): void {
  ActivityLog.create({
    userId: input.userId,
    userName: input.userName,
    action: input.action,
    module: input.module,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    details: input.details,
  }).catch((err) => {
    console.error('Failed to write activity log:', err);
  });
}
