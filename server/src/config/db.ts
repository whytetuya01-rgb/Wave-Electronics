import mongoose from 'mongoose';
import { resolveMongoUri } from './env.js';

let isReplicaSet = false;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(resolveMongoUri());
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    
    // Check if connected MongoDB instance is a replica set
    try {
      let hello: any = null;
      if (conn.connection.db) {
        try {
          hello = await conn.connection.db.command({ hello: 1 });
        } catch {
          try {
            hello = await conn.connection.db.command({ isMaster: 1 });
          } catch {
            const adminDb = conn.connection.db?.admin();
            if (adminDb) {
              hello = await adminDb.command({ hello: 1 });
            }
          }
        }
      }

      const client = typeof conn.connection.getClient === 'function' ? conn.connection.getClient() : (conn.connection as any).client;
      const topology = client?.topology?.description;
      const topologyType = topology?.type;
      const topologySetName = topology?.setName;

      isReplicaSet = Boolean(
        hello?.setName ||
        topologySetName ||
        topologyType === 'ReplicaSetWithPrimary' ||
        topologyType === 'ReplicaSetNoPrimary' ||
        topologyType === 'Sharded'
      );

      console.log(
        `[MongoDB Mode]: ${
          isReplicaSet
            ? `Replica Set (${hello?.setName || topologySetName || topologyType}) - ACID Transactions Active`
            : 'Standalone (Atomic sequence fallback)'
        }`
      );
    } catch (modeErr) {
      console.warn('[MongoDB Mode Detection Warning]:', modeErr);
      isReplicaSet = false;
    }

    // Production must never silently fall back to non-transactional stock
    // writes: standalone MongoDB cannot guarantee atomicity across the
    // multi-document operations Job Approval/Issue will perform (reserving
    // stock across many components + writing ledger entries together).
    if (process.env.NODE_ENV === 'production' && !isReplicaSet) {
      console.error(
        '[FATAL] Production requires a transaction-capable MongoDB replica set. ' +
          'Standalone MongoDB cannot guarantee atomic multi-document stock operations. Refusing to start.'
      );
      process.exit(1);
    }

    return conn;
  } catch (error) {
    console.error('[MongoDB Connection Error]:', error);
    process.exit(1);
  }
};

export const getIsReplicaSet = () => {
  if (isReplicaSet) return true;

  // Dynamic re-check from Mongoose client topology in case discovery completed after boot
  try {
    const client = typeof mongoose.connection.getClient === 'function'
      ? mongoose.connection.getClient()
      : (mongoose.connection as any).client;
    const topology = client?.topology?.description;
    if (
      topology?.setName ||
      topology?.type === 'ReplicaSetWithPrimary' ||
      topology?.type === 'Sharded'
    ) {
      isReplicaSet = true;
      return true;
    }
  } catch {
    // Ignore and fallback
  }

  return isReplicaSet;
};
