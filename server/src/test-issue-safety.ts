import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, getIsReplicaSet } from './config/db.js';
import { assertDisposableDatabase } from './config/databaseSafety.js';

// Day 4 Priority 5 - Phase 7 Test 17: "Standalone MongoDB fails safely
// without partial writes" for Material Issue. Mirrors test-approval-safety.ts
// but for performMaterialIssue - must run against an ACTUAL standalone
// (non-replica-set) MongoDB connection to be meaningful.
async function runIssueSafetyCheck() {
  console.log('====================================================');
  console.log('   TEST - MATERIAL ISSUE FAILS SAFELY WITHOUT TRANSACTIONS');
  console.log('====================================================\n');

  await connectDB();
  assertDisposableDatabase('test-issue-safety');

  if (getIsReplicaSet()) {
    console.log('  ⚠ This MongoDB connection IS a replica set - this check needs a standalone');
    console.log('    deployment to be meaningful. Point MONGODB_URI at the standalone instance.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const { Job } = await import('./models/Job.js');
  const { Component } = await import('./models/Component.js');
  const { DeliveryChallan } = await import('./models/DeliveryChallan.js');
  const { performMaterialIssue } = await import('./controllers/jobController.js');
  const { TransactionUnavailableError } = await import('./utils/transaction.js');

  const beforeJobCount = await Job.countDocuments();
  const beforeChallanCount = await DeliveryChallan.countDocuments();
  const components = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  const stockSnapshotBefore = JSON.stringify(components);

  let caught: any = null;
  try {
    await performMaterialIssue(
      new mongoose.Types.ObjectId().toString(),
      [{ componentId: new mongoose.Types.ObjectId().toString(), qty: 1 }],
      `safety-check-${Date.now()}`,
      new mongoose.Types.ObjectId()
    );
  } catch (e) {
    caught = e;
  }

  if (!(caught instanceof TransactionUnavailableError)) {
    throw new Error(`Expected TransactionUnavailableError, got: ${caught}`);
  }
  console.log(`  ✓ performMaterialIssue() threw TransactionUnavailableError: "${caught.message}"`);

  const afterJobCount = await Job.countDocuments();
  const afterChallanCount = await DeliveryChallan.countDocuments();
  const componentsAfter = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  const stockSnapshotAfter = JSON.stringify(componentsAfter);

  if (beforeJobCount !== afterJobCount) throw new Error('Job collection count changed despite transaction being unavailable');
  if (beforeChallanCount !== afterChallanCount) throw new Error('DeliveryChallan collection count changed despite transaction being unavailable');
  if (stockSnapshotBefore !== stockSnapshotAfter) throw new Error('Component stock changed despite transaction being unavailable');

  console.log('  ✓ No Job, Component, or DeliveryChallan documents were modified');
  console.log('  ✓ Pass: Material issue fails safely (no partial/non-atomic write) when transactions are unavailable\n');
  console.log('====================================================');
  console.log('   TEST PASSED');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runIssueSafetyCheck().catch((err) => {
  console.error('Issue safety test failed:', err);
  process.exit(1);
});
