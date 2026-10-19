import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB, getIsReplicaSet } from './config/db.js';

// Day 5 Priority 6 - Phase 6 item 15: "Standalone MongoDB safe-failure
// behavior" for Material Receipt. Mirrors test-approval-safety.ts /
// test-issue-safety.ts - must run against an ACTUAL standalone
// (non-replica-set) MongoDB connection to be meaningful.
async function runReceiptSafetyCheck() {
  console.log('====================================================');
  console.log('   TEST - MATERIAL RECEIPT FAILS SAFELY WITHOUT TRANSACTIONS');
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
  const { DeliveryChallan } = await import('./models/DeliveryChallan.js');
  const { MaterialReceipt } = await import('./models/MaterialReceipt.js');
  const { performMaterialReceipt } = await import('./controllers/receiptController.js');
  const { TransactionUnavailableError } = await import('./utils/transaction.js');

  const beforeJobCount = await Job.countDocuments();
  const beforeChallanCount = await DeliveryChallan.countDocuments();
  const beforeReceiptCount = await MaterialReceipt.countDocuments();
  const components = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  const stockSnapshotBefore = JSON.stringify(components);

  let caught: any = null;
  try {
    await performMaterialReceipt(
      new mongoose.Types.ObjectId().toString(),
      [{ componentId: new mongoose.Types.ObjectId().toString(), receivedQty: 1, damagedQty: 0 }],
      `safety-check-${Date.now()}`,
      new mongoose.Types.ObjectId()
    );
  } catch (e) {
    caught = e;
  }

  if (!(caught instanceof TransactionUnavailableError)) {
    throw new Error(`Expected TransactionUnavailableError, got: ${caught}`);
  }
  console.log(`  ✓ performMaterialReceipt() threw TransactionUnavailableError: "${caught.message}"`);

  const afterJobCount = await Job.countDocuments();
  const afterChallanCount = await DeliveryChallan.countDocuments();
  const afterReceiptCount = await MaterialReceipt.countDocuments();
  const componentsAfter = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  const stockSnapshotAfter = JSON.stringify(componentsAfter);

  if (beforeJobCount !== afterJobCount) throw new Error('Job collection count changed despite transaction being unavailable');
  if (beforeChallanCount !== afterChallanCount) throw new Error('DeliveryChallan collection count changed despite transaction being unavailable');
  if (beforeReceiptCount !== afterReceiptCount) throw new Error('MaterialReceipt collection count changed despite transaction being unavailable');
  if (stockSnapshotBefore !== stockSnapshotAfter) throw new Error('Component stock changed despite transaction being unavailable');

  console.log('  ✓ No Job, Component, DeliveryChallan, or MaterialReceipt documents were modified');
  console.log('  ✓ Pass: Material receipt fails safely (no partial/non-atomic write) when transactions are unavailable\n');
  console.log('====================================================');
  console.log('   TEST PASSED');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runReceiptSafetyCheck().catch((err) => {
  console.error('Receipt safety test failed:', err);
  process.exit(1);
});
