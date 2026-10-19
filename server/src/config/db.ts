import mongoose from 'mongoose';

let isReplicaSet = false;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wave_electronics');
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    
    // Check if connected MongoDB instance is a replica set
    try {
      const adminDb = conn.connection.db?.admin();
      if (adminDb) {
        const hello = await adminDb.command({ hello: 1 });
        isReplicaSet = Boolean(hello.setName);
        console.log(`[MongoDB Mode]: ${isReplicaSet ? `Replica Set (${hello.setName}) - ACID Transactions Active` : 'Standalone (Atomic sequence fallback)'}`);
      }
    } catch {
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

export const getIsReplicaSet = () => isReplicaSet;
