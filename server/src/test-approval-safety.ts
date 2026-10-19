import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, getIsReplicaSet } from './config/db.js';

// Day 3 Priority 4 - Test 44: "Approval without transaction support fails
// safely." This must be run against an ACTUAL standalone (non-replica-set)
// MongoDB connection - the real local dev deployment - to prove the
// guarantee for real, not as a mocked unit test.
async function runApprovalSafetyCheck() {
  console.log('====================================================');
  console.log('   TEST 44 - APPROVAL FAILS SAFELY WITHOUT TRANSACTIONS');
  console.log('====================================================\n');

  await connectDB();

  if (getIsReplicaSet()) {
    console.log('  ⚠ This MongoDB connection IS a replica set - this check needs a standalone');
    console.log('    deployment to be meaningful. Point MONGODB_URI at the standalone instance.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const { Job } = await import('./models/Job.js');
  const { Component } = await import('./models/Component.js');
  const { performJobApproval } = await import('./controllers/jobController.js');
  const { TransactionUnavailableError } = await import('./utils/transaction.js');

  const beforeJobCount = await Job.countDocuments();
  const components = await Component.find({}, 'reservedStock').lean();
  const stockSnapshotBefore = JSON.stringify(components);

  let caught: any = null;
  try {
    // Arbitrary id - it must never even reach a DB read for the job, since
    // the transaction-availability check runs before anything else.
    await performJobApproval(new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId());
  } catch (e) {
    caught = e;
  }

  if (!(caught instanceof TransactionUnavailableError)) {
    throw new Error(`Expected TransactionUnavailableError, got: ${caught}`);
  }
  console.log(`  ✓ performJobApproval() threw TransactionUnavailableError: "${caught.message}"`);

  const afterJobCount = await Job.countDocuments();
  const componentsAfter = await Component.find({}, 'reservedStock').lean();
  const stockSnapshotAfter = JSON.stringify(componentsAfter);

  if (beforeJobCount !== afterJobCount) {
    throw new Error('Job collection count changed despite transaction being unavailable');
  }
  if (stockSnapshotBefore !== stockSnapshotAfter) {
    throw new Error('Component reservedStock changed despite transaction being unavailable');
  }

  console.log('  ✓ No Job or Component documents were modified');
  console.log('  ✓ Pass: Approval fails safely (no partial/non-atomic write) when transactions are unavailable\n');
  console.log('====================================================');
  console.log('   TEST 44 PASSED');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runApprovalSafetyCheck().catch((err) => {
  console.error('Test 44 failed:', err);
  process.exit(1);
});
