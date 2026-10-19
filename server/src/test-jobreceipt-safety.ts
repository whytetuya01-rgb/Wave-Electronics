import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, getIsReplicaSet } from './config/db.js';

// Day 5 Correction - Critical Safeguard #8: "Reject inventory operations
// when transactions are unavailable" for the new combined job-receiving and
// job-closing workflows. Mirrors test-approval-safety.ts / test-issue-
// safety.ts / test-receipt-safety.ts - must run against an ACTUAL
// standalone (non-replica-set) MongoDB connection to be meaningful.
async function runJobReceiptSafetyCheck() {
  console.log('====================================================');
  console.log('   TEST - JOB RECEIPT & CLOSING FAIL SAFELY WITHOUT TRANSACTIONS');
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
  const { FinishedGoods } = await import('./models/FinishedGoods.js');
  const { JobReceipt } = await import('./models/JobReceipt.js');
  const { performJobReceipt } = await import('./controllers/jobReceiptController.js');
  const { performJobClose } = await import('./controllers/jobController.js');
  const { TransactionUnavailableError } = await import('./utils/transaction.js');

  const snapshotBefore = JSON.stringify({
    jobs: await Job.countDocuments(),
    finishedGoods: await FinishedGoods.countDocuments(),
    jobReceipts: await JobReceipt.countDocuments(),
    components: await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean(),
  });

  let receiptCaught: any = null;
  try {
    await performJobReceipt(
      new mongoose.Types.ObjectId().toString(),
      { circuitReceipts: [{ jobCircuitId: new mongoose.Types.ObjectId().toString(), goodQty: 1, rejectedQty: 0 }] },
      `safety-check-${Date.now()}`,
      new mongoose.Types.ObjectId()
    );
  } catch (e) {
    receiptCaught = e;
  }
  if (!(receiptCaught instanceof TransactionUnavailableError)) {
    throw new Error(`Expected performJobReceipt to throw TransactionUnavailableError, got: ${receiptCaught}`);
  }
  console.log(`  ✓ performJobReceipt() threw TransactionUnavailableError: "${receiptCaught.message}"`);

  let closeCaught: any = null;
  try {
    await performJobClose(new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId());
  } catch (e) {
    closeCaught = e;
  }
  if (!(closeCaught instanceof TransactionUnavailableError)) {
    throw new Error(`Expected performJobClose to throw TransactionUnavailableError, got: ${closeCaught}`);
  }
  console.log(`  ✓ performJobClose() threw TransactionUnavailableError: "${closeCaught.message}"`);

  const snapshotAfter = JSON.stringify({
    jobs: await Job.countDocuments(),
    finishedGoods: await FinishedGoods.countDocuments(),
    jobReceipts: await JobReceipt.countDocuments(),
    components: await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean(),
  });

  if (snapshotBefore !== snapshotAfter) {
    throw new Error('Database state changed despite transactions being unavailable - a non-atomic write slipped through');
  }

  console.log('  ✓ No Job, Component, FinishedGoods, or JobReceipt documents were modified');
  console.log('  ✓ Pass: Both job receiving and job closing fail safely when transactions are unavailable\n');
  console.log('====================================================');
  console.log('   TEST PASSED');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runJobReceiptSafetyCheck().catch((err) => {
  console.error('Job receipt safety test failed:', err);
  process.exit(1);
});
