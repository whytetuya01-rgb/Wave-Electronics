import mongoose, { ClientSession } from 'mongoose';
import { getIsReplicaSet } from '../config/db.js';

/**
 * Executes a function within a MongoDB transaction if replica set is available,
 * or gracefully runs it directly if running on a standalone development instance.
 */
export async function withTransaction<T>(
  callback: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const isReplica = getIsReplicaSet();

  if (!isReplica) {
    // Defense in depth: connectDB() already refuses to start in production
    // without a replica set, but if this is ever reached anyway, fail loudly
    // instead of silently running a multi-document write without atomicity.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Refusing non-transactional fallback for a multi-document stock operation in production (no replica-set MongoDB connection).'
      );
    }
    // Standalone dev fallback: execute directly without session
    return await callback(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

// Thrown when a caller asks for a required transaction but no replica-set
// MongoDB connection is available. Distinct type so callers (route handlers)
// can map it to a specific HTTP status without string-matching messages.
export class TransactionUnavailableError extends Error {
  constructor(
    message = 'This operation requires a transaction-capable MongoDB deployment (replica set). No changes were made.'
  ) {
    super(message);
    this.name = 'TransactionUnavailableError';
  }
}

/**
 * Like withTransaction, but NEVER falls back to non-transactional execution,
 * in any environment. For operations like Job Approval that reserve stock
 * across multiple components atomically, a fallback that "mostly works" is
 * worse than a clear failure - partial, non-atomic reservation would corrupt
 * inventory data silently. If no replica set is available, this throws
 * TransactionUnavailableError immediately, before the callback runs, so
 * nothing is ever written non-atomically.
 *
 * Uses the driver's own session.withTransaction() retry wrapper (rather than
 * manually calling startTransaction/commitTransaction) so transient errors
 * and write conflicts under concurrent approvals are retried per MongoDB's
 * documented pattern. This is safe here because the callback performs only
 * MongoDB reads/writes - no external side effects - so a retried callback
 * simply re-reads fresh state and re-applies the same logic; nothing
 * non-idempotent is ever replayed.
 */
export async function withRequiredTransaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!getIsReplicaSet()) {
    throw new TransactionUnavailableError();
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
