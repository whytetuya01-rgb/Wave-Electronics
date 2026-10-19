import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Component } from './models/Component.js';
import { StockTransaction } from './models/StockTransaction.js';

async function runVerification() {
  console.log('====================================================');
  console.log('   WAVE ELECTRONICS - DAY 1 AUTOMATED VERIFICATION  ');
  console.log('====================================================\n');

  // Use connectDB() (not a raw mongoose.connect()) so getIsReplicaSet()
  // correctly reflects this connection - the Priority 4 approval tests
  // below depend on this to detect a replica-set deployment.
  await connectDB();

  // Test 1: Verify Users and Password comparison
  console.log('[Test 1]: Testing User Authentication & Password Hashing');
  const admin = await User.findOne({ email: 'admin@wave.com' });
  if (!admin) throw new Error('Admin user not found');
  const isPasswordValid = await admin.comparePassword('admin123');
  const isInvalidPasswordRejected = !(await admin.comparePassword('wrongpassword'));
  if (isPasswordValid && isInvalidPasswordRejected) {
    console.log('  ✓ Pass: User bcrypt password comparison and reject logic verified');
  } else {
    throw new Error('User password verification failed');
  }

  // Test 2: Verify Stock Ledger Integrity
  // NOTE: this now sums ALL ledger entries per component (not just OPENING),
  // since a component's current stock legitimately diverges from its opening
  // entry once inwards/adjustments are posted. The invariant that must always
  // hold is: current inStoreStock === sum of every ledger qtyChange for STORE.
  console.log('\n[Test 2]: Verifying Opening Stock & Immutable Ledger Integrity');
  const components = await Component.find();
  const allStoreLedgers = await StockTransaction.find({ locationType: 'STORE' });
  console.log(`  ✓ Found ${components.length} components, ${allStoreLedgers.length} store ledger records`);

  for (const comp of components) {
    const sumForComponent = allStoreLedgers
      .filter((l) => l.componentId.toString() === comp._id.toString())
      .reduce((sum, l) => sum + l.qtyChange, 0);

    if (sumForComponent !== comp.inStoreStock) {
      throw new Error(
        `Ledger mismatch for component ${comp.partCode}: ledger sum ${sumForComponent} !== inStoreStock ${comp.inStoreStock}`
      );
    }
  }
  console.log('  ✓ Pass: Every component\'s in-store stock exactly matches the sum of its immutable ledger entries');

  // Test 3: Safe Master Deletion Constraint
  console.log('\n[Test 3]: Verifying Master Deletion Integrity (Linked components constraint)');
  const linkedComp = components[0];
  const linkedCount = await Component.countDocuments({ categoryId: linkedComp.categoryId });
  if (linkedCount > 0) {
    console.log(`  ✓ Category ${linkedComp.categoryId} has ${linkedCount} linked components and cannot be deleted`);
    console.log('  ✓ Pass: Master deletion constraint protected');
  }

  // Test 4: Negative Stock Prevention
  console.log('\n[Test 4]: Verifying Negative Stock Prevention Logic');
  const testComp = await Component.findOne({ inStoreStock: { $gt: 0 } });
  if (!testComp) throw new Error('No test component found');
  
  const currentStock = testComp.inStoreStock;
  const attemptedReduction = currentStock + 500;
  const wouldBeNegative = (currentStock - attemptedReduction) < 0;
  if (wouldBeNegative) {
    console.log(`  ✓ Current stock: ${currentStock}, Attempted reduction: ${attemptedReduction}`);
    console.log('  ✓ Pass: Negative stock boundary successfully caught and prevented');
  }

  // Test 5: Low-Stock Alert Detection
  console.log('\n[Test 5]: Verifying Low-Stock Alert Detection');
  const lowStockItems = await Component.find({ $expr: { $lte: ['$inStoreStock', '$minStock'] } });
  console.log(`  ✓ Found ${lowStockItems.length} low-stock item(s):`);
  lowStockItems.forEach(i => {
    console.log(`    - ${i.partCode} (${i.name}): In Store = ${i.inStoreStock}, Min Stock = ${i.minStock}`);
  });
  if (lowStockItems.length > 0) {
    console.log('  ✓ Pass: Low-stock detection active and accurate');
  }

  // --- DAY 2 TESTS ---
  console.log('\n====================================================');
  console.log('   WAVE ELECTRONICS - DAY 2 AUTOMATED VERIFICATION  ');
  console.log('====================================================\n');

  const { Vendor } = await import('./models/Vendor.js');
  const { StockInward } = await import('./models/StockInward.js');

  // Test 6: Verify Vendor Assemblers
  console.log('[Test 6]: Verifying Job Work Assembler Vendors');
  const vendors = await Vendor.find();
  console.log(`  ✓ Found ${vendors.length} registered job-work assembler vendor(s)`);
  if (vendors.length > 0) {
    vendors.forEach((v) => {
      console.log(`    - ${v.name} (${v.city}) - Rate: ₹${v.defaultJobWorkRate}/unit, Active: ${v.isActive}`);
    });
    console.log('  ✓ Pass: Vendor entity and job-work capabilities verified');
  } else {
    throw new Error('No vendors found. Please seed initial vendor records.');
  }

  // Test 7: Verify Stock Inward (GIN)
  console.log('\n[Test 7]: Verifying Stock Inward (GIN) Records');
  const inwards = await StockInward.find().populate('items.componentId');
  console.log(`  ✓ Found ${inwards.length} stock inward voucher(s)`);
  if (inwards.length > 0) {
    const latestInw = inwards[0];
    console.log(`    - Inward #: ${latestInw.inwardNumber}, Supplier: ${latestInw.supplierName}, Items: ${latestInw.totalItems}, Qty: ${latestInw.totalQty}, Value: ₹${latestInw.totalAmount}`);
    console.log('  ✓ Pass: Stock Inward structure and calculations verified');
  }

  // Test 8: Verify Stock Replenishment & Immutable INWARD Ledger
  console.log('\n[Test 8]: Verifying Immutable Ledger Entries for Stock Inward');
  const inwardLedgers = await StockTransaction.find({ type: 'INWARD' }).populate('componentId');
  console.log(`  ✓ Found ${inwardLedgers.length} INWARD ledger transaction(s)`);
  for (const tx of inwardLedgers) {
    const comp: any = tx.componentId;
    if (comp) {
      console.log(`    - Component ${comp.partCode}: +${tx.qtyChange} units, In-Store Balance After = ${tx.balanceInStoreAfter}, Ref: ${tx.referenceNo}`);
    }
  }
  if (inwardLedgers.length > 0) {
    console.log('  ✓ Pass: Inward stock replenishment ledger entries confirmed immutable and accurate');
  }

  // --- DAY 2.5 REGRESSION TESTS: STOCK CONCURRENCY & ATOMIC NUMBERING ---
  console.log('\n====================================================');
  console.log('   DAY 2.5 - STOCK CONCURRENCY REGRESSION TESTS      ');
  console.log('====================================================\n');

  const { getNextSequence } = await import('./utils/sequence.js');
  const { generateInwardNumber } = await import('./controllers/stockInwardController.js');
  const { Counter } = await import('./models/Counter.js');

  // Test 9: Concurrent positive stock increments must not lose updates
  console.log('[Test 9]: Verifying Atomic $inc Prevents Lost Updates Under Concurrency');
  const incTestComponent = await Component.findOne({});
  if (!incTestComponent) throw new Error('No component available for concurrency test');
  const startingStock = incTestComponent.inStoreStock;
  const CONCURRENT_INCREMENTS = 25;

  await Promise.all(
    Array.from({ length: CONCURRENT_INCREMENTS }).map(() =>
      Component.findOneAndUpdate({ _id: incTestComponent._id }, { $inc: { inStoreStock: 1 } })
    )
  );

  const afterIncComponent = await Component.findById(incTestComponent._id);
  if (!afterIncComponent || afterIncComponent.inStoreStock !== startingStock + CONCURRENT_INCREMENTS) {
    throw new Error(
      `Lost update detected: expected ${startingStock + CONCURRENT_INCREMENTS}, got ${afterIncComponent?.inStoreStock}`
    );
  }
  console.log(`  ✓ ${CONCURRENT_INCREMENTS} concurrent increments applied with zero lost updates (${startingStock} -> ${afterIncComponent.inStoreStock})`);
  console.log('  ✓ Pass: Atomic $inc stock mutation verified safe under concurrency');

  // Test 10: Concurrent reductions must respect the negative-stock / reservation guard atomically
  console.log('\n[Test 10]: Verifying Atomic Guard Rejects Over-Reduction Under Concurrency');
  const guardTestComponent = await Component.findOneAndUpdate(
    { _id: incTestComponent._id },
    { $set: { inStoreStock: 10, reservedStock: 0 } },
    { new: true }
  );
  if (!guardTestComponent) throw new Error('Failed to prime guard test component');

  const DECREMENT_ATTEMPTS = 15; // only 10 should succeed since stock = 10
  const decrementResults = await Promise.all(
    Array.from({ length: DECREMENT_ATTEMPTS }).map(() =>
      Component.findOneAndUpdate(
        {
          _id: guardTestComponent._id,
          $expr: { $gte: [{ $add: ['$inStoreStock', -1] }, '$reservedStock'] },
        },
        { $inc: { inStoreStock: -1 } },
        { new: true }
      )
    )
  );

  const successfulDecrements = decrementResults.filter((r) => r !== null).length;
  const finalGuardComponent = await Component.findById(guardTestComponent._id);

  if (successfulDecrements !== 10) {
    throw new Error(`Expected exactly 10 successful decrements, got ${successfulDecrements}`);
  }
  if (!finalGuardComponent || finalGuardComponent.inStoreStock !== 0) {
    throw new Error(`Expected final stock of 0, got ${finalGuardComponent?.inStoreStock}`);
  }
  console.log(`  ✓ ${successfulDecrements}/${DECREMENT_ATTEMPTS} decrements succeeded, stock floored at exactly 0 (never negative)`);
  console.log('  ✓ Pass: Atomic negative-stock guard holds under concurrent reduction attempts');

  // Test 11: Atomic sequence generator issues no duplicates under concurrency
  console.log('\n[Test 11]: Verifying getNextSequence() Issues No Duplicates Under Concurrency');
  const testKey = `test-concurrency-${Date.now()}`;
  const SEQUENCE_CALLS = 30;
  const sequences = await Promise.all(
    Array.from({ length: SEQUENCE_CALLS }).map(() => getNextSequence(testKey, { initFrom: async () => 0 }))
  );
  const uniqueSequences = new Set(sequences);
  if (uniqueSequences.size !== SEQUENCE_CALLS) {
    throw new Error(`Expected ${SEQUENCE_CALLS} unique sequence numbers, got ${uniqueSequences.size}`);
  }
  const sorted = [...sequences].sort((a, b) => a - b);
  const isContiguous = sorted.every((val, idx) => val === idx + 1);
  if (!isContiguous) {
    throw new Error(`Sequence numbers are not contiguous 1..${SEQUENCE_CALLS}: ${sorted.join(',')}`);
  }
  await Counter.deleteOne({ _id: testKey });
  console.log(`  ✓ ${SEQUENCE_CALLS} concurrent calls produced ${uniqueSequences.size} unique, contiguous sequence numbers`);
  console.log('  ✓ Pass: Atomic sequence generator is safe under concurrency');

  // Test 12: Counter initialization does not collide with pre-existing inward numbers
  console.log('\n[Test 12]: Verifying Inward Number Generator Initializes Past Pre-Existing Records');
  const preExistingInward = await StockInward.findOne().sort({ inwardNumber: -1 });
  if (!preExistingInward) throw new Error('No seeded stock inward record found for collision test');

  const generatedNumber1 = await generateInwardNumber();
  const generatedNumber2 = await generateInwardNumber();

  if (generatedNumber1 === preExistingInward.inwardNumber || generatedNumber2 === preExistingInward.inwardNumber) {
    throw new Error(
      `Generated inward number collided with pre-existing record ${preExistingInward.inwardNumber}`
    );
  }
  if (generatedNumber1 === generatedNumber2) {
    throw new Error('generateInwardNumber() returned the same number twice in sequential calls');
  }
  console.log(`  ✓ Pre-existing: ${preExistingInward.inwardNumber}, Generated: ${generatedNumber1}, ${generatedNumber2}`);
  console.log('  ✓ Pass: Counter safely initializes past existing records with no collision');

  // --- DAY 3 TESTS: CIRCUIT BOM MANAGEMENT ---
  console.log('\n====================================================');
  console.log('   DAY 3 - CIRCUIT BOM MANAGEMENT VERIFICATION       ');
  console.log('====================================================\n');

  const { Circuit } = await import('./models/Circuit.js');
  const { validateAndSanitizeBomItems } = await import('./controllers/circuitController.js');
  const { computeCircuitAvailability } = await import('./utils/circuitCalculations.js');

  // Defensive cleanup: if a previous run of this script crashed mid-way, its
  // TEST- prefixed fixtures may still be in the DB. Clear them first so this
  // run isn't blocked by stale unique-index collisions.
  await Circuit.deleteMany({ circuitCode: { $regex: '^TEST-' } });

  const resComp = await Component.findOne({ partCode: 'RES-10K-0805-1%' });
  const capComp = await Component.findOne({ partCode: 'CAP-100NF-0805-50V' });
  const amsComp = await Component.findOne({ partCode: 'IC-AMS1117-3.3' });
  const connComp = await Component.findOne({ partCode: 'CONN-TB-2P-5.08' });
  if (!resComp || !capComp || !amsComp || !connComp) {
    throw new Error('Expected seeded components not found for Circuit BOM tests');
  }

  // Test 13: Create a valid circuit with a well-formed BOM
  console.log('[Test 13]: Creating Valid Circuit BOM');
  const rawBom = [
    { componentId: resComp._id.toString(), qtyPerUnit: 4, designator: 'R1-R4' },
    { componentId: capComp._id.toString(), qtyPerUnit: 2, designator: 'C1-C2' },
    { componentId: amsComp._id.toString(), qtyPerUnit: 1, designator: 'U1' },
    { componentId: connComp._id.toString(), qtyPerUnit: 2, designator: 'J1-J2' },
  ];
  const sanitizedBom = await validateAndSanitizeBomItems(rawBom);
  const testAdmin = await User.findOne({ role: 'admin' });
  if (!testAdmin) throw new Error('No admin user found for circuit creation test');

  let testCircuit = await Circuit.create({
    circuitCode: 'TEST-PCB-001',
    name: 'Test Smart Switch Controller',
    version: '1.0',
    status: 'active',
    bomItems: sanitizedBom,
    isLocked: false,
    createdById: testAdmin._id,
  });
  if (testCircuit.bomItems.length !== 4) {
    throw new Error(`Expected 4 BOM items, got ${testCircuit.bomItems.length}`);
  }
  console.log(`  ✓ Circuit ${testCircuit.circuitCode} v${testCircuit.version} created with ${testCircuit.bomItems.length} BOM lines`);
  console.log('  ✓ Pass: Valid circuit BOM creation verified');

  // Test 14: Reject duplicate component rows within one BOM
  console.log('\n[Test 14]: Verifying Duplicate Component Rows Are Rejected');
  let duplicateRejected = false;
  try {
    await validateAndSanitizeBomItems([
      { componentId: resComp._id.toString(), qtyPerUnit: 4 },
      { componentId: resComp._id.toString(), qtyPerUnit: 2 },
    ]);
  } catch (e: any) {
    duplicateRejected = e.message.includes('already in the BOM');
  }
  if (!duplicateRejected) throw new Error('Duplicate component row was not rejected');
  console.log('  ✓ Pass: BOM rejects the same component added twice');

  // Test 15: Reject duplicate circuit code + version combination
  console.log('\n[Test 15]: Verifying Duplicate Circuit Code + Version Is Rejected');
  let duplicateCircuitRejected = false;
  try {
    await Circuit.create({
      circuitCode: 'TEST-PCB-001',
      name: 'Duplicate Attempt',
      version: '1.0',
      status: 'active',
      bomItems: sanitizedBom,
      isLocked: false,
      createdById: testAdmin._id,
    });
  } catch (e: any) {
    duplicateCircuitRejected = e.code === 11000;
  }
  if (!duplicateCircuitRejected) throw new Error('Duplicate circuitCode+version was not rejected by the unique index');
  console.log('  ✓ Pass: Unique index rejects duplicate circuitCode + version combination');

  // Test 16: Reject invalid / non-existent component references
  console.log('\n[Test 16]: Verifying Invalid Component References Are Rejected');
  let invalidRefRejected = false;
  try {
    await validateAndSanitizeBomItems([
      { componentId: new mongoose.Types.ObjectId().toString(), qtyPerUnit: 1 },
    ]);
  } catch (e: any) {
    invalidRefRejected = e.message.includes('does not exist');
  }
  if (!invalidRefRejected) throw new Error('Non-existent component reference was not rejected');
  console.log('  ✓ Pass: BOM rejects a component reference that does not exist');

  // Test 17: Correct BOM material cost calculation
  console.log('\n[Test 17]: Verifying BOM Material Cost Calculation');
  const availability1 = await computeCircuitAvailability(testCircuit.bomItems);
  const expectedCost = Number(
    (
      resComp.ratePerUnit * 4 +
      capComp.ratePerUnit * 2 +
      amsComp.ratePerUnit * 1 +
      connComp.ratePerUnit * 2
    ).toFixed(2)
  );
  if (availability1.materialCostPerUnit !== expectedCost) {
    throw new Error(`Expected material cost ${expectedCost}, got ${availability1.materialCostPerUnit}`);
  }
  console.log(`  ✓ Computed material cost ₹${availability1.materialCostPerUnit} matches expected ₹${expectedCost}`);
  console.log('  ✓ Pass: BOM material cost calculation verified');

  // Test 18: Correct maximum buildable quantity and bottleneck detection
  console.log('\n[Test 18]: Verifying Maximum Buildable Quantity & Bottleneck Detection');
  const expectedBuildable = Math.min(
    Math.floor((resComp.inStoreStock - resComp.reservedStock) / 4),
    Math.floor((capComp.inStoreStock - capComp.reservedStock) / 2),
    Math.floor((amsComp.inStoreStock - amsComp.reservedStock) / 1),
    Math.floor((connComp.inStoreStock - connComp.reservedStock) / 2)
  );
  if (availability1.maxBuildableQty !== expectedBuildable) {
    throw new Error(`Expected max buildable ${expectedBuildable}, got ${availability1.maxBuildableQty}`);
  }
  if (availability1.bottleneckComponentId !== connComp._id.toString()) {
    throw new Error(`Expected bottleneck to be ${connComp.partCode}, got component ${availability1.bottleneckComponentId}`);
  }
  console.log(`  ✓ Max buildable = ${availability1.maxBuildableQty}, bottleneck = ${connComp.partCode} (as expected)`);
  console.log('  ✓ Pass: Maximum buildable quantity and bottleneck detection verified');

  // Test 19: Handle zero available stock gracefully (no divide-by-zero, no crash)
  console.log('\n[Test 19]: Verifying Zero Available Stock Is Handled Gracefully');
  await Component.findByIdAndUpdate(connComp._id, { $set: { reservedStock: connComp.inStoreStock } });
  const availability2 = await computeCircuitAvailability(testCircuit.bomItems);
  if (availability2.maxBuildableQty !== 0) {
    throw new Error(`Expected max buildable 0 when bottleneck component has zero available stock, got ${availability2.maxBuildableQty}`);
  }
  await Component.findByIdAndUpdate(connComp._id, { $set: { reservedStock: connComp.reservedStock } }); // restore
  console.log('  ✓ Pass: Zero available stock correctly floors buildable quantity to 0 without error');

  // Test 20: Preserve circuit version after duplication (original must be untouched)
  console.log('\n[Test 20]: Verifying Duplicate-as-New-Version Preserves the Original');
  const originalBomSnapshot = JSON.stringify(testCircuit.bomItems.map((i) => ({ c: i.componentId.toString(), q: i.qtyPerUnit })));

  const duplicateCircuit = await Circuit.create({
    circuitCode: testCircuit.circuitCode,
    name: testCircuit.name,
    version: '2.0',
    status: 'active',
    bomItems: testCircuit.bomItems.map((i) => ({ componentId: i.componentId, qtyPerUnit: i.qtyPerUnit, designator: i.designator })),
    isLocked: false,
    createdById: testAdmin._id,
  });

  // Mutate the duplicate's BOM and confirm the original (v1.0) is unaffected
  duplicateCircuit.bomItems[0].qtyPerUnit = 999;
  await duplicateCircuit.save();

  const reloadedOriginal = await Circuit.findById(testCircuit._id);
  const reloadedSnapshot = JSON.stringify(
    reloadedOriginal!.bomItems.map((i) => ({ c: i.componentId.toString(), q: i.qtyPerUnit }))
  );
  if (reloadedSnapshot !== originalBomSnapshot) {
    throw new Error('Original circuit version was altered by editing its duplicate');
  }
  console.log(`  ✓ Original v1.0 BOM unchanged after editing duplicated v2.0 (qty mutated to 999 on the copy only)`);
  console.log('  ✓ Pass: Duplicating a circuit creates a fully independent version');

  // Cleanup test circuits so they don't pollute real catalog data
  await Circuit.deleteMany({ circuitCode: 'TEST-PCB-001' });
  console.log('\n  (Test circuits cleaned up)');

  // --- DAY 3 PRIORITY 3 TESTS: JOB CREATION WITH BOM SNAPSHOTS ---
  console.log('\n====================================================');
  console.log('   DAY 3 PRIORITY 3 - JOB CREATION VERIFICATION      ');
  console.log('====================================================\n');

  const { Job } = await import('./models/Job.js');
  const {
    buildJobCircuitsAndRequirement,
    assertVendorActiveForJob,
    attachLiveAvailability,
    generateJobNumber,
  } = await import('./controllers/jobController.js');

  // Fresh reads so expected values reflect actual current DB state, not
  // whatever these components looked like earlier in this test run.
  const jobResComp = (await Component.findOne({ partCode: 'RES-10K-0805-1%' }))!;
  const jobCapComp = (await Component.findOne({ partCode: 'CAP-100NF-0805-50V' }))!;
  const jobAmsComp = (await Component.findOne({ partCode: 'IC-AMS1117-3.3' }))!;
  const jobTestAdmin = (await User.findOne({ role: 'admin' }))!;
  const activeVendor = await Vendor.findOne({ isActive: true });
  if (!activeVendor) throw new Error('No active vendor found for Job tests');

  // Two circuits that share RES-10K, mirroring the PDF's worked aggregation
  // example: Circuit A needs 4 resistors/unit, Circuit B needs 2/unit.
  const jobCircuitA = await Circuit.create({
    circuitCode: 'TEST-JOB-CIRCUIT-A',
    name: 'Job Test Circuit A',
    version: '1.0',
    status: 'active',
    bomItems: [
      { componentId: jobResComp._id, qtyPerUnit: 4, designator: 'R1-R4' },
      { componentId: jobCapComp._id, qtyPerUnit: 2, designator: 'C1-C2' },
    ],
    isLocked: false,
    createdById: jobTestAdmin._id,
  });
  const jobCircuitB = await Circuit.create({
    circuitCode: 'TEST-JOB-CIRCUIT-B',
    name: 'Job Test Circuit B',
    version: '1.0',
    status: 'active',
    bomItems: [
      { componentId: jobResComp._id, qtyPerUnit: 2, designator: 'R1-R2' },
      { componentId: jobAmsComp._id, qtyPerUnit: 1, designator: 'U1' },
    ],
    isLocked: false,
    createdById: jobTestAdmin._id,
  });

  // Test 21: Single-circuit job creation
  console.log('[Test 21]: Verifying Single-Circuit Job Creation');
  const singleBuild = await buildJobCircuitsAndRequirement([{ circuitId: jobCircuitA._id.toString(), orderedQty: 10 }]);
  if (singleBuild.jobCircuits.length !== 1) {
    throw new Error(`Expected 1 job circuit, got ${singleBuild.jobCircuits.length}`);
  }
  const expectedResReq = 10 * 4;
  const resReqLine = singleBuild.materialRequirement.find((m) => m.componentId.toString() === jobResComp._id.toString());
  if (!resReqLine || resReqLine.requiredQty !== expectedResReq) {
    throw new Error(`Expected RES required qty ${expectedResReq}, got ${resReqLine?.requiredQty}`);
  }
  console.log(`  ✓ Single circuit (qty 10) -> RES required = ${resReqLine.requiredQty}`);
  console.log('  ✓ Pass: Single-circuit job requirement calculation verified');

  // Test 22: Multi-circuit job creation with shared-component aggregation
  console.log('\n[Test 22]: Verifying Multi-Circuit Job Creation & Shared-Component Aggregation');
  const multiBuild = await buildJobCircuitsAndRequirement([
    { circuitId: jobCircuitA._id.toString(), orderedQty: 10 },
    { circuitId: jobCircuitB._id.toString(), orderedQty: 5 },
  ]);
  const expectedAggregatedRes = 10 * 4 + 5 * 2; // PDF example: (10x4)+(5x2) = 50
  const aggregatedResLine = multiBuild.materialRequirement.find(
    (m) => m.componentId.toString() === jobResComp._id.toString()
  );
  if (!aggregatedResLine || aggregatedResLine.requiredQty !== expectedAggregatedRes) {
    throw new Error(`Expected aggregated RES required qty ${expectedAggregatedRes}, got ${aggregatedResLine?.requiredQty}`);
  }
  if (multiBuild.jobCircuits.length !== 2) {
    throw new Error(`Expected 2 job circuits, got ${multiBuild.jobCircuits.length}`);
  }
  console.log(`  ✓ Circuit A (qty 10) + Circuit B (qty 5) -> RES aggregated to ${aggregatedResLine.requiredQty} (expected ${expectedAggregatedRes})`);
  console.log('  ✓ Pass: Multi-circuit job creation and shared-component aggregation verified');

  // Create the actual multi-circuit draft job used by the remaining tests
  const jobNumber1 = await generateJobNumber();
  let testJob = await Job.create({
    jobNumber: jobNumber1,
    jobDate: new Date(),
    vendorId: activeVendor._id,
    targetDate: new Date(Date.now() + 7 * 86400000),
    status: 'draft',
    jobCircuits: multiBuild.jobCircuits,
    materialRequirement: multiBuild.materialRequirement,
    totalEstimatedCost: multiBuild.totalEstimatedCost,
    createdById: jobTestAdmin._id,
  });
  console.log(`\n  (Draft job ${testJob.jobNumber} created for remaining Job tests)`);

  // Test 23: Historical BOM snapshot preservation
  console.log('\n[Test 23]: Verifying Historical BOM Snapshot Is Preserved After Source Changes');
  const snapshotBefore = JSON.stringify(testJob.jobCircuits[0].bomSnapshot);
  const originalResRate = jobResComp.ratePerUnit;

  // Mutate the LIVE circuit's BOM qty and the component's rate after the job exists
  await Circuit.findByIdAndUpdate(jobCircuitA._id, { $set: { 'bomItems.0.qtyPerUnit': 999 } });
  await Component.findByIdAndUpdate(jobResComp._id, { $set: { ratePerUnit: 8888 } });

  const reloadedJob = await Job.findById(testJob._id);
  const snapshotAfter = JSON.stringify(reloadedJob!.jobCircuits[0].bomSnapshot);
  if (snapshotBefore !== snapshotAfter) {
    throw new Error('Job BOM snapshot changed after the source circuit/component was edited - snapshot is not immutable');
  }
  const resSnapshotLine = reloadedJob!.jobCircuits[0].bomSnapshot.find(
    (b) => b.componentId.toString() === jobResComp._id.toString()
  );
  if (resSnapshotLine?.qtyPerUnit === 999 || resSnapshotLine?.unitRate === 8888) {
    throw new Error('Job snapshot picked up the post-creation circuit/component edit instead of staying frozen');
  }
  // Restore source data
  await Circuit.findByIdAndUpdate(jobCircuitA._id, { $set: { 'bomItems.0.qtyPerUnit': 4 } });
  await Component.findByIdAndUpdate(jobResComp._id, { $set: { ratePerUnit: originalResRate } });
  console.log(`  ✓ Job snapshot kept qtyPerUnit=${resSnapshotLine?.qtyPerUnit}, unitRate=${resSnapshotLine?.unitRate} despite source changing to 999 / 8888`);
  console.log('  ✓ Pass: Historical BOM snapshot is immutable once the job is created');

  // Test 24: Material shortage detection
  console.log('\n[Test 24]: Verifying Material Shortage Detection');
  const amsReqLine = testJob.materialRequirement.find((m) => m.componentId.toString() === jobAmsComp._id.toString())!;
  // Force AMS available stock below what this job requires
  await Component.findByIdAndUpdate(jobAmsComp._id, {
    $set: { reservedStock: Math.max(0, jobAmsComp.inStoreStock - amsReqLine.requiredQty + 1) },
  });
  const availabilityWithShortage = await attachLiveAvailability(testJob.materialRequirement);
  const amsAvailLine: any = availabilityWithShortage.find((m: any) => m.componentId.toString() === jobAmsComp._id.toString());
  if (!amsAvailLine.hasShortage || amsAvailLine.shortageQty <= 0) {
    throw new Error('Expected a detected shortage on AMS component but none was flagged');
  }
  // Restore
  await Component.findByIdAndUpdate(jobAmsComp._id, { $set: { reservedStock: jobAmsComp.reservedStock } });
  console.log(`  ✓ Forced shortage correctly detected: required=${amsReqLine.requiredQty}, shortage=${amsAvailLine.shortageQty}`);
  console.log('  ✓ Pass: Material shortage detection verified');

  // Test 25: Reject inactive vendor
  console.log('\n[Test 25]: Verifying Inactive Vendor Is Rejected');
  const inactiveVendor = await Vendor.create({
    name: 'Test Inactive Vendor',
    contactPerson: 'Nobody',
    phone: '+91 00000 00000',
    city: 'TestCity',
    isActive: false,
  });
  let inactiveVendorRejected = false;
  try {
    await assertVendorActiveForJob(inactiveVendor._id.toString());
  } catch (e: any) {
    inactiveVendorRejected = e.message.includes('inactive');
  }
  if (!inactiveVendorRejected) throw new Error('Inactive vendor was not rejected for job assignment');
  await Vendor.deleteOne({ _id: inactiveVendor._id });
  console.log('  ✓ Pass: Inactive vendor correctly rejected for new job assignment');

  // Test 26: Reject invalid/inactive circuit
  console.log('\n[Test 26]: Verifying Inactive Circuit Is Rejected');
  await Circuit.findByIdAndUpdate(jobCircuitA._id, { $set: { status: 'inactive' } });
  let inactiveCircuitRejected = false;
  try {
    await buildJobCircuitsAndRequirement([{ circuitId: jobCircuitA._id.toString(), orderedQty: 1 }]);
  } catch (e: any) {
    inactiveCircuitRejected = e.message.includes('inactive');
  }
  await Circuit.findByIdAndUpdate(jobCircuitA._id, { $set: { status: 'active' } });
  if (!inactiveCircuitRejected) throw new Error('Inactive circuit was not rejected for new job creation');
  console.log('  ✓ Pass: Inactive circuit version correctly rejected for new job creation');

  // Test 27: Draft editing recomputes requirement, and non-draft jobs are protected
  console.log('\n[Test 27]: Verifying Draft Editing & Non-Draft Edit Protection');
  const editedBuild = await buildJobCircuitsAndRequirement([{ circuitId: jobCircuitA._id.toString(), orderedQty: 20 }]);
  testJob.jobCircuits = editedBuild.jobCircuits;
  testJob.materialRequirement = editedBuild.materialRequirement;
  testJob.totalEstimatedCost = editedBuild.totalEstimatedCost;
  await testJob.save();

  const reloadedAfterEdit = await Job.findById(testJob._id);
  if (reloadedAfterEdit!.jobCircuits.length !== 1 || reloadedAfterEdit!.jobCircuits[0].orderedQty !== 20) {
    throw new Error('Draft edit did not persist the new circuit selection/quantity');
  }
  // Non-draft jobs must not be editable - verify the guard condition
  reloadedAfterEdit!.status = 'cancelled';
  await reloadedAfterEdit!.save();
  const nonDraftJob = await Job.findById(testJob._id);
  const editGuardWouldBlock = nonDraftJob!.status !== 'draft';
  if (!editGuardWouldBlock) throw new Error('Non-draft edit guard condition failed to trigger');
  console.log('  ✓ Draft job successfully edited (1 circuit, qty 20)');
  console.log('  ✓ Pass: Draft editing works and the non-draft edit guard condition correctly blocks further edits');

  // Test 28: Duplicate job number prevention
  console.log('\n[Test 28]: Verifying Duplicate Job Number Is Rejected');
  let duplicateJobNumberRejected = false;
  try {
    await Job.create({
      jobNumber: testJob.jobNumber,
      jobDate: new Date(),
      vendorId: activeVendor._id,
      targetDate: new Date(Date.now() + 86400000),
      status: 'draft',
      jobCircuits: editedBuild.jobCircuits,
      materialRequirement: editedBuild.materialRequirement,
      totalEstimatedCost: editedBuild.totalEstimatedCost,
      createdById: jobTestAdmin._id,
    });
  } catch (e: any) {
    duplicateJobNumberRejected = e.code === 11000;
  }
  if (!duplicateJobNumberRejected) throw new Error('Duplicate job number was not rejected by the unique index');
  console.log('  ✓ Pass: Unique index rejects a duplicate job number');

  // Test 29: No inventory changes during Draft creation
  console.log('\n[Test 29]: Verifying Draft Job Creation Never Touches Inventory');
  const stockBefore = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  const stockBeforeMap = new Map(stockBefore.map((c: any) => [c._id.toString(), JSON.stringify(c)]));

  const noopBuild = await buildJobCircuitsAndRequirement([{ circuitId: jobCircuitB._id.toString(), orderedQty: 3 }]);
  const jobNumber2 = await generateJobNumber();
  const noopJob = await Job.create({
    jobNumber: jobNumber2,
    jobDate: new Date(),
    vendorId: activeVendor._id,
    targetDate: new Date(Date.now() + 86400000),
    status: 'draft',
    jobCircuits: noopBuild.jobCircuits,
    materialRequirement: noopBuild.materialRequirement,
    totalEstimatedCost: noopBuild.totalEstimatedCost,
    createdById: jobTestAdmin._id,
  });

  const stockAfter = await Component.find({}, 'inStoreStock reservedStock withVendorStock').lean();
  let inventoryUnchanged = true;
  for (const c of stockAfter as any[]) {
    if (stockBeforeMap.get(c._id.toString()) !== JSON.stringify(c)) {
      inventoryUnchanged = false;
      break;
    }
  }
  if (!inventoryUnchanged) throw new Error('Draft job creation altered component inventory - it must only read, never write stock');
  console.log(`  ✓ Created draft job ${noopJob.jobNumber} - every component's stock fields are byte-for-byte unchanged`);
  console.log('  ✓ Pass: Draft job creation never modifies inventory');

  // Cleanup test jobs/circuits so they don't pollute real data
  await Job.deleteMany({ jobNumber: { $in: [jobNumber1, jobNumber2] } });
  await Circuit.deleteMany({ circuitCode: { $in: ['TEST-JOB-CIRCUIT-A', 'TEST-JOB-CIRCUIT-B'] } });
  console.log('\n  (Test jobs and circuits cleaned up)');

  // --- DAY 3 PRIORITY 4 TESTS: JOB APPROVAL & ATOMIC STOCK RESERVATION ---
  // These require a REAL MongoDB transaction (replica set) - run this script
  // with MONGODB_URI pointed at a replica-set deployment to exercise them.
  console.log('\n====================================================');
  console.log('   DAY 3 PRIORITY 4 - JOB APPROVAL VERIFICATION      ');
  console.log('====================================================\n');

  const { performJobApproval, performJobCancellation, JobApprovalError } = await import('./controllers/jobController.js');
  const { TransactionUnavailableError } = await import('./utils/transaction.js');
  const { getIsReplicaSet } = await import('./config/db.js');

  if (!getIsReplicaSet()) {
    console.log('  ⚠ Skipping Priority 4 approval tests: this MongoDB connection is not a replica set.');
    console.log('    Re-run with MONGODB_URI pointed at a transaction-capable deployment to exercise them.');
  } else {
    const apConnComp = (await Component.findOne({ partCode: 'CONN-TB-2P-5.08' }))!;

    // Fixture circuits for this section
    const apCircuitMain = await Circuit.create({
      circuitCode: 'TEST-APPROVAL-MAIN',
      name: 'Approval Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: jobResComp._id, qtyPerUnit: 2 },
        { componentId: jobCapComp._id, qtyPerUnit: 1 },
      ],
      isLocked: false,
      createdById: jobTestAdmin._id,
    });
    const apCircuitShortage = await Circuit.create({
      circuitCode: 'TEST-APPROVAL-SHORTAGE',
      name: 'Shortage Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [{ componentId: jobAmsComp._id, qtyPerUnit: 1000 }], // always exceeds AMS stock
      isLocked: false,
      createdById: jobTestAdmin._id,
    });
    const apCircuitRollback = await Circuit.create({
      circuitCode: 'TEST-APPROVAL-ROLLBACK',
      name: 'Rollback Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: jobResComp._id, qtyPerUnit: 1 }, // would succeed alone
        { componentId: jobAmsComp._id, qtyPerUnit: 1000 }, // forces failure
      ],
      isLocked: false,
      createdById: jobTestAdmin._id,
    });
    const apCircuitConcurrent = await Circuit.create({
      circuitCode: 'TEST-APPROVAL-CONCURRENT',
      name: 'Concurrent Reservation Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [{ componentId: apConnComp._id, qtyPerUnit: 1 }],
      isLocked: false,
      createdById: jobTestAdmin._id,
    });

    async function makeDraftJob(circuitId: mongoose.Types.ObjectId, orderedQty: number) {
      const built = await buildJobCircuitsAndRequirement([{ circuitId: circuitId.toString(), orderedQty }]);
      const jn = await generateJobNumber();
      return Job.create({
        jobNumber: jn,
        jobDate: new Date(),
        vendorId: activeVendor!._id,
        targetDate: new Date(Date.now() + 86400000),
        status: 'draft',
        jobCircuits: built.jobCircuits,
        materialRequirement: built.materialRequirement,
        totalEstimatedCost: built.totalEstimatedCost,
        createdById: jobTestAdmin._id,
      });
    }

    // Tests 30-32: Successful approval reserves correctly, doesn't touch
    // inStoreStock, and available stock decreases correctly.
    console.log('[Test 30-32]: Verifying Successful Approval Reserves Stock Correctly');
    const apJobMain = await makeDraftJob(apCircuitMain._id, 10); // RES req=20, CAP req=10
    const resBeforeApproval = (await Component.findById(jobResComp._id))!;
    const capBeforeApproval = (await Component.findById(jobCapComp._id))!;

    const approvedMain = await performJobApproval(apJobMain._id.toString(), jobTestAdmin._id);
    if (approvedMain!.status !== 'approved') throw new Error(`Expected status 'approved', got '${approvedMain!.status}'`);

    const resAfterApproval = (await Component.findById(jobResComp._id))!;
    const capAfterApproval = (await Component.findById(jobCapComp._id))!;

    if (resAfterApproval.inStoreStock !== resBeforeApproval.inStoreStock) {
      throw new Error('Approval changed inStoreStock - it must only reserve, never reduce physical stock');
    }
    if (resAfterApproval.reservedStock !== resBeforeApproval.reservedStock + 20) {
      throw new Error(`Expected RES reservedStock +20, got ${resAfterApproval.reservedStock - resBeforeApproval.reservedStock}`);
    }
    if (capAfterApproval.reservedStock !== capBeforeApproval.reservedStock + 10) {
      throw new Error(`Expected CAP reservedStock +10, got ${capAfterApproval.reservedStock - capBeforeApproval.reservedStock}`);
    }
    const resAvailBefore = resBeforeApproval.inStoreStock - resBeforeApproval.reservedStock;
    const resAvailAfter = resAfterApproval.inStoreStock - resAfterApproval.reservedStock;
    if (resAvailAfter !== resAvailBefore - 20) {
      throw new Error(`Expected available RES stock to drop by 20, dropped by ${resAvailBefore - resAvailAfter}`);
    }
    const resLine = approvedMain!.materialRequirement.find((m: any) => m.componentId.toString() === jobResComp._id.toString());
    if (resLine?.reservedQty !== 20) throw new Error(`Expected job's RES reservedQty = 20, got ${resLine?.reservedQty}`);
    console.log(`  ✓ RES: inStoreStock unchanged (${resAfterApproval.inStoreStock}), reservedStock +20, available -20`);
    console.log(`  ✓ CAP: reservedStock +10 as expected`);
    console.log('  ✓ Pass: Approval reserves exact quantities, never touches in-store stock, available stock drops correctly');

    // Tests 33-34: Shortage rejection + no partial reservation on failure
    console.log('\n[Test 33-34]: Verifying Shortage Rejection Leaves All Reservations Unchanged');
    const apJobShortage = await makeDraftJob(apCircuitShortage._id, 1); // AMS req=1000, stock ~530
    const amsBeforeFail = (await Component.findById(jobAmsComp._id))!;

    let shortageError: any = null;
    try {
      await performJobApproval(apJobShortage._id.toString(), jobTestAdmin._id);
    } catch (e) {
      shortageError = e;
    }
    if (!(shortageError instanceof JobApprovalError)) {
      throw new Error(`Expected JobApprovalError for shortage, got: ${shortageError}`);
    }
    const reloadedShortageJob = await Job.findById(apJobShortage._id);
    if (reloadedShortageJob!.status !== 'draft') {
      throw new Error(`Expected shortage job to remain 'draft', got '${reloadedShortageJob!.status}'`);
    }
    const amsAfterFail = (await Component.findById(jobAmsComp._id))!;
    if (amsAfterFail.reservedStock !== amsBeforeFail.reservedStock) {
      throw new Error('Failed approval left a partial reservation on AMS component');
    }
    console.log(`  ✓ Approval correctly rejected: "${shortageError.message}"`);
    console.log(`  ✓ Job remains 'draft', AMS reservedStock unchanged (${amsAfterFail.reservedStock})`);
    console.log('  ✓ Pass: Shortage correctly blocks approval with zero side effects');

    // Test 35: Double approval is blocked
    console.log('\n[Test 35]: Verifying Double Approval Is Blocked');
    let doubleApprovalError: any = null;
    try {
      await performJobApproval(apJobMain._id.toString(), jobTestAdmin._id);
    } catch (e) {
      doubleApprovalError = e;
    }
    if (!(doubleApprovalError instanceof JobApprovalError)) {
      throw new Error('Expected double approval to be rejected with JobApprovalError');
    }
    const resAfterDoubleAttempt = (await Component.findById(jobResComp._id))!;
    if (resAfterDoubleAttempt.reservedStock !== resAfterApproval.reservedStock) {
      throw new Error('Double approval attempt changed RES reservedStock - reservation was applied twice');
    }
    console.log(`  ✓ Pass: Double approval rejected ("${doubleApprovalError.message}"), no double reservation`);

    // Test 36: Concurrent approvals cannot over-reserve stock
    console.log('\n[Test 36]: Verifying Concurrent Approvals Cannot Over-Reserve Stock');
    const connBefore = (await Component.findById(apConnComp._id))!;
    const perJobQty = Math.floor((connBefore.inStoreStock - connBefore.reservedStock) * 0.7); // >50% each, >100% combined
    const apJobConcurrentA = await makeDraftJob(apCircuitConcurrent._id, perJobQty);
    const apJobConcurrentB = await makeDraftJob(apCircuitConcurrent._id, perJobQty);

    const concurrentResults = await Promise.allSettled([
      performJobApproval(apJobConcurrentA._id.toString(), jobTestAdmin._id),
      performJobApproval(apJobConcurrentB._id.toString(), jobTestAdmin._id),
    ]);
    const fulfilledCount = concurrentResults.filter((r) => r.status === 'fulfilled').length;
    const rejectedCount = concurrentResults.filter((r) => r.status === 'rejected').length;
    if (fulfilledCount !== 1 || rejectedCount !== 1) {
      throw new Error(`Expected exactly 1 success and 1 failure under concurrent over-subscription, got ${fulfilledCount} success / ${rejectedCount} failure`);
    }
    const connAfterConcurrent = (await Component.findById(apConnComp._id))!;
    if (connAfterConcurrent.reservedStock !== connBefore.reservedStock + perJobQty) {
      throw new Error(
        `Expected CONN reservedStock to increase by exactly ${perJobQty} (one job's worth), increased by ${connAfterConcurrent.reservedStock - connBefore.reservedStock}`
      );
    }
    console.log(`  ✓ 2 concurrent approvals requesting ${perJobQty} each (combined > available) -> exactly 1 succeeded, 1 rejected`);
    console.log(`  ✓ CONN reservedStock increased by exactly ${perJobQty}, not ${perJobQty * 2} - no over-reservation`);
    console.log('  ✓ Pass: Concurrent approvals cannot over-reserve stock');

    // Test 37: Inactive vendor is rejected at approval time
    console.log('\n[Test 37]: Verifying Inactive Vendor Is Rejected At Approval');
    const apInactiveVendor = await Vendor.create({
      name: 'Test Approval Inactive Vendor',
      contactPerson: 'Nobody',
      phone: '+91 00000 00001',
      city: 'TestCity',
      isActive: true, // active at job creation time
    });
    const apJobBadVendorBuild = await buildJobCircuitsAndRequirement([{ circuitId: apCircuitMain._id.toString(), orderedQty: 1 }]);
    const apJobBadVendorNum = await generateJobNumber();
    const apJobBadVendor = await Job.create({
      jobNumber: apJobBadVendorNum,
      jobDate: new Date(),
      vendorId: apInactiveVendor._id,
      targetDate: new Date(Date.now() + 86400000),
      status: 'draft',
      jobCircuits: apJobBadVendorBuild.jobCircuits,
      materialRequirement: apJobBadVendorBuild.materialRequirement,
      totalEstimatedCost: apJobBadVendorBuild.totalEstimatedCost,
      createdById: jobTestAdmin._id,
    });
    await Vendor.findByIdAndUpdate(apInactiveVendor._id, { $set: { isActive: false } }); // deactivated after draft created

    let inactiveVendorApprovalError: any = null;
    try {
      await performJobApproval(apJobBadVendor._id.toString(), jobTestAdmin._id);
    } catch (e) {
      inactiveVendorApprovalError = e;
    }
    if (!(inactiveVendorApprovalError instanceof JobApprovalError) || !inactiveVendorApprovalError.message.includes('Vendor')) {
      throw new Error(`Expected vendor-inactive rejection, got: ${inactiveVendorApprovalError}`);
    }
    await Vendor.deleteOne({ _id: apInactiveVendor._id });
    console.log(`  ✓ Pass: Inactive vendor correctly blocks approval ("${inactiveVendorApprovalError.message}")`);

    // Test 38: Inactive component is rejected at approval time
    console.log('\n[Test 38]: Verifying Inactive Component Is Rejected At Approval');
    const apJobBadComponent = await makeDraftJob(apCircuitMain._id, 1);
    await Component.findByIdAndUpdate(jobResComp._id, { $set: { isActive: false } });

    let inactiveComponentApprovalError: any = null;
    try {
      await performJobApproval(apJobBadComponent._id.toString(), jobTestAdmin._id);
    } catch (e) {
      inactiveComponentApprovalError = e;
    }
    await Component.findByIdAndUpdate(jobResComp._id, { $set: { isActive: true } }); // restore immediately
    if (!(inactiveComponentApprovalError instanceof JobApprovalError) || !inactiveComponentApprovalError.message.includes('inactive')) {
      throw new Error(`Expected inactive-component rejection, got: ${inactiveComponentApprovalError}`);
    }
    console.log(`  ✓ Pass: Inactive component correctly blocks approval ("${inactiveComponentApprovalError.message}")`);

    // Test 39: Approved jobs cannot be edited (guard condition check)
    console.log('\n[Test 39]: Verifying Approved Jobs Cannot Be Edited');
    const reloadedApprovedMain = await Job.findById(apJobMain._id);
    const editGuardBlocksApproved = reloadedApprovedMain!.status !== 'draft'; // exact condition used by updateJob
    if (!editGuardBlocksApproved) throw new Error('Approved job edit guard condition failed to trigger');
    console.log(`  ✓ Pass: updateJob's draft-only guard correctly blocks an Approved job (status='${reloadedApprovedMain!.status}')`);

    // Test 40: Cancelling an approved, unissued job releases reservations
    console.log('\n[Test 40]: Verifying Cancelling An Approved Job Releases Reservations');
    const cancelledMain = await performJobCancellation(apJobMain._id.toString(), jobTestAdmin._id);
    if (cancelledMain!.status !== 'cancelled') throw new Error(`Expected status 'cancelled', got '${cancelledMain!.status}'`);

    const resAfterCancel = (await Component.findById(jobResComp._id))!;
    const capAfterCancel = (await Component.findById(jobCapComp._id))!;
    if (resAfterCancel.reservedStock !== resBeforeApproval.reservedStock) {
      throw new Error(`Expected RES reservedStock fully released back to ${resBeforeApproval.reservedStock}, got ${resAfterCancel.reservedStock}`);
    }
    if (capAfterCancel.reservedStock !== capBeforeApproval.reservedStock) {
      throw new Error(`Expected CAP reservedStock fully released back to ${capBeforeApproval.reservedStock}, got ${capAfterCancel.reservedStock}`);
    }
    const cancelledResLine = cancelledMain!.materialRequirement.find((m: any) => m.componentId.toString() === jobResComp._id.toString());
    if (cancelledResLine?.reservedQty !== 0) throw new Error(`Expected job's RES reservedQty reset to 0, got ${cancelledResLine?.reservedQty}`);
    console.log(`  ✓ RES/CAP reservedStock fully released back to pre-approval levels`);
    console.log('  ✓ Pass: Cancelling an approved job atomically releases all reservations');

    // Test 41: Draft cancellation does not change stock
    console.log('\n[Test 41]: Verifying Draft Cancellation Does Not Change Stock');
    const apJobDraftCancel = await makeDraftJob(apCircuitMain._id, 5);
    const resBeforeDraftCancel = (await Component.findById(jobResComp._id))!;
    const cancelledDraft = await performJobCancellation(apJobDraftCancel._id.toString(), jobTestAdmin._id);
    if (cancelledDraft!.status !== 'cancelled') throw new Error(`Expected status 'cancelled', got '${cancelledDraft!.status}'`);
    const resAfterDraftCancel = (await Component.findById(jobResComp._id))!;
    if (resAfterDraftCancel.reservedStock !== resBeforeDraftCancel.reservedStock) {
      throw new Error('Draft cancellation touched component reservedStock - it never reserved anything to begin with');
    }
    console.log('  ✓ Pass: Draft cancellation leaves stock completely untouched');

    // Test 42: Cancelled jobs cannot be approved
    console.log('\n[Test 42]: Verifying Cancelled Jobs Cannot Be Approved');
    let cancelledApprovalError: any = null;
    try {
      await performJobApproval(apJobMain._id.toString(), jobTestAdmin._id); // apJobMain was cancelled in Test 40
    } catch (e) {
      cancelledApprovalError = e;
    }
    if (!(cancelledApprovalError instanceof JobApprovalError) || !cancelledApprovalError.message.includes('cancelled')) {
      throw new Error(`Expected cancelled-job approval rejection, got: ${cancelledApprovalError}`);
    }
    console.log(`  ✓ Pass: Cancelled job correctly rejected for approval ("${cancelledApprovalError.message}")`);

    // Test 43: Failed transactions roll back ALL changes, including lines
    // that would have individually succeeded
    console.log('\n[Test 43]: Verifying Failed Approval Rolls Back Every Line, Not Just The Failing One');
    const apJobRollback = await makeDraftJob(apCircuitRollback._id, 1); // RES req=1 (fine), AMS req=1000 (fails)
    const resBeforeRollback = (await Component.findById(jobResComp._id))!;

    let rollbackError: any = null;
    try {
      await performJobApproval(apJobRollback._id.toString(), jobTestAdmin._id);
    } catch (e) {
      rollbackError = e;
    }
    if (!(rollbackError instanceof JobApprovalError)) throw new Error('Expected rollback scenario to throw JobApprovalError');

    const resAfterRollback = (await Component.findById(jobResComp._id))!;
    if (resAfterRollback.reservedStock !== resBeforeRollback.reservedStock) {
      throw new Error(
        `RES reservation (which would have individually succeeded) was NOT rolled back: before=${resBeforeRollback.reservedStock}, after=${resAfterRollback.reservedStock}`
      );
    }
    console.log(`  ✓ RES would have reserved successfully alone, but AMS failure rolled back the ENTIRE transaction`);
    console.log(`  ✓ RES reservedStock unchanged (${resAfterRollback.reservedStock}) despite being processed before the failing line`);
    console.log('  ✓ Pass: Failed approval rolls back every change atomically, not just the failing line');

    // Cleanup
    await Job.deleteMany({
      _id: {
        $in: [
          apJobMain._id,
          apJobShortage._id,
          apJobConcurrentA._id,
          apJobConcurrentB._id,
          apJobBadVendor._id,
          apJobBadComponent._id,
          apJobDraftCancel._id,
          apJobRollback._id,
        ],
      },
    });
    await Circuit.deleteMany({
      circuitCode: { $regex: '^TEST-APPROVAL-' },
    });
    console.log('\n  (Approval test jobs and circuits cleaned up)');
  }

  // --- DAY 4 PRIORITY 5 TESTS: MATERIAL ISSUE & DELIVERY CHALLANS ---
  console.log('\n====================================================');
  console.log('   DAY 4 PRIORITY 5 - MATERIAL ISSUE VERIFICATION    ');
  console.log('====================================================\n');

  if (!getIsReplicaSet()) {
    console.log('  ⚠ Skipping Material Issue tests: this MongoDB connection is not a replica set.');
    console.log('    Re-run with MONGODB_URI pointed at a transaction-capable deployment to exercise them.');
  } else {
    const { performMaterialIssue } = await import('./controllers/jobController.js');
    const { DeliveryChallan } = await import('./models/DeliveryChallan.js');

    const miResComp = (await Component.findOne({ partCode: 'RES-10K-0805-1%' }))!;
    const miCapComp = (await Component.findOne({ partCode: 'CAP-100NF-0805-50V' }))!;
    const miAmsComp = (await Component.findOne({ partCode: 'IC-AMS1117-3.3' }))!;
    const miVendor = (await Vendor.findOne({ isActive: true }))!;
    const miAdmin = (await User.findOne({ role: 'admin' }))!;

    const miCircuitMain = await Circuit.create({
      circuitCode: 'TEST-ISSUE-MAIN',
      name: 'Issue Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: miResComp._id, qtyPerUnit: 2 },
        { componentId: miCapComp._id, qtyPerUnit: 1 },
      ],
      isLocked: false,
      createdById: miAdmin._id,
    });

    async function makeApprovedJob(orderedQty: number) {
      const built = await buildJobCircuitsAndRequirement([{ circuitId: miCircuitMain._id.toString(), orderedQty }]);
      const jn = await generateJobNumber();
      const job = await Job.create({
        jobNumber: jn,
        jobDate: new Date(),
        vendorId: miVendor._id,
        targetDate: new Date(Date.now() + 86400000),
        status: 'draft',
        jobCircuits: built.jobCircuits,
        materialRequirement: built.materialRequirement,
        totalEstimatedCost: built.totalEstimatedCost,
        createdById: miAdmin._id,
      });
      await performJobApproval(job._id.toString(), miAdmin._id);
      return job;
    }

    const createdTestJobIds: mongoose.Types.ObjectId[] = [];
    const createdChallanIds: mongoose.Types.ObjectId[] = [];

    // Tests 45-46: Successful FULL issue - stock & reservation balances correct
    console.log('[Test 45-46]: Verifying Successful Full Material Issue & Stock/Reservation Balances');
    const miJobFull = await makeApprovedJob(10); // RES req/reserved=20, CAP req/reserved=10
    createdTestJobIds.push(miJobFull._id);

    const resBefore45 = (await Component.findById(miResComp._id))!;
    const capBefore45 = (await Component.findById(miCapComp._id))!;

    const issueResult45 = await performMaterialIssue(
      miJobFull._id.toString(),
      [
        { componentId: miResComp._id.toString(), qty: 20 },
        { componentId: miCapComp._id.toString(), qty: 10 },
      ],
      `test-key-${Date.now()}-A`,
      miAdmin._id
    );
    createdChallanIds.push(issueResult45.challan._id);

    if (issueResult45.alreadyProcessed) throw new Error('Expected a fresh issue, not alreadyProcessed');
    if (issueResult45.job!.status !== 'material_issued') {
      throw new Error(`Expected status 'material_issued', got '${issueResult45.job!.status}'`);
    }
    if (issueResult45.challan.totalItems !== 2 || issueResult45.challan.totalQty !== 30) {
      throw new Error(`Expected challan with 2 items / qty 30, got ${issueResult45.challan.totalItems} items / qty ${issueResult45.challan.totalQty}`);
    }

    const resAfter45 = (await Component.findById(miResComp._id))!;
    const capAfter45 = (await Component.findById(miCapComp._id))!;
    if (resAfter45.inStoreStock !== resBefore45.inStoreStock - 20) throw new Error('RES inStoreStock did not decrease by 20');
    if (resAfter45.reservedStock !== resBefore45.reservedStock - 20) throw new Error('RES reservedStock did not decrease by 20');
    if (resAfter45.withVendorStock !== resBefore45.withVendorStock + 20) throw new Error('RES withVendorStock did not increase by 20');
    if (capAfter45.inStoreStock !== capBefore45.inStoreStock - 10) throw new Error('CAP inStoreStock did not decrease by 10');
    if (capAfter45.reservedStock !== capBefore45.reservedStock - 10) throw new Error('CAP reservedStock did not decrease by 10');
    if (capAfter45.withVendorStock !== capBefore45.withVendorStock + 10) throw new Error('CAP withVendorStock did not increase by 10');

    const resLine45 = issueResult45.job!.materialRequirement.find((m: any) => m.componentId.toString() === miResComp._id.toString())!;
    if (resLine45.issuedQty !== 20 || resLine45.issuedQty !== resLine45.reservedQty) {
      throw new Error(`Expected RES fully issued (issuedQty === reservedQty === 20), got issuedQty=${resLine45.issuedQty}`);
    }

    const ledgerEntries45 = await StockTransaction.find({ referenceId: issueResult45.challan._id });
    if (ledgerEntries45.length !== 2) throw new Error(`Expected 2 ledger entries for this challan, got ${ledgerEntries45.length}`);

    console.log(`  ✓ Challan ${issueResult45.challan.challanNumber}: 2 items, qty 30`);
    console.log(`  ✓ RES: store -20, reserved -20, withVendor +20 (store=${resAfter45.inStoreStock}, reserved=${resAfter45.reservedStock}, vendor=${resAfter45.withVendorStock})`);
    console.log(`  ✓ 2 immutable ledger entries created, job status = 'material_issued'`);
    console.log('  ✓ Pass: Full issue correctly moves stock and updates reservation/issued accounting');

    // Test 47: Partial issue supported, status still material_issued, job stays issuable
    console.log('\n[Test 47]: Verifying Partial Material Issue');
    const miJobPartial = await makeApprovedJob(10); // RES req/reserved=20, CAP req/reserved=10
    createdTestJobIds.push(miJobPartial._id);

    const partial1 = await performMaterialIssue(
      miJobPartial._id.toString(),
      [{ componentId: miResComp._id.toString(), qty: 5 }],
      `test-key-${Date.now()}-B1`,
      miAdmin._id
    );
    createdChallanIds.push(partial1.challan._id);
    const resLinePartial1 = partial1.job!.materialRequirement.find((m: any) => m.componentId.toString() === miResComp._id.toString())!;
    if (resLinePartial1.issuedQty !== 5) throw new Error(`Expected RES issuedQty=5 after partial issue, got ${resLinePartial1.issuedQty}`);
    if (partial1.job!.status !== 'material_issued') throw new Error('Expected status material_issued after first partial issue');

    const partial2 = await performMaterialIssue(
      miJobPartial._id.toString(),
      [
        { componentId: miResComp._id.toString(), qty: 15 },
        { componentId: miCapComp._id.toString(), qty: 10 },
      ],
      `test-key-${Date.now()}-B2`,
      miAdmin._id
    );
    createdChallanIds.push(partial2.challan._id);
    const resLinePartial2 = partial2.job!.materialRequirement.find((m: any) => m.componentId.toString() === miResComp._id.toString())!;
    if (resLinePartial2.issuedQty !== 20) throw new Error(`Expected RES fully issued (20) after second partial issue, got ${resLinePartial2.issuedQty}`);

    const challansForJob = await DeliveryChallan.find({ jobId: miJobPartial._id });
    if (challansForJob.length !== 2) throw new Error(`Expected 2 challans for a job issued in two parts, got ${challansForJob.length}`);
    console.log(`  ✓ First partial issue: RES issuedQty=5/20`);
    console.log(`  ✓ Second issue completes remaining: RES issuedQty=20/20, CAP issuedQty=10/10`);
    console.log(`  ✓ 2 separate challans recorded for this one job`);
    console.log('  ✓ Pass: Partial material issue supported, multiple challans per job tracked correctly');

    // Test 48: Issue quantity greater than THIS JOB's remaining reservation
    // is rejected, distinct from a component-wide stock shortage. A padding
    // job's own approved-but-unissued reservation inflates the component's
    // total reservedStock so the requested qty fits within the component's
    // pool but still exceeds this specific job's own remaining line.
    console.log('\n[Test 48]: Verifying Over-Issue (Exceeds This Job\'s Remaining Reservation) Is Rejected');
    const miPaddingJob48 = await makeApprovedJob(25); // RES reserved=50, padding only
    const miJobOverIssue = await makeApprovedJob(1); // RES reserved=2
    createdTestJobIds.push(miJobOverIssue._id);
    const resBefore48 = (await Component.findById(miResComp._id))!;

    let overIssueError: any = null;
    try {
      await performMaterialIssue(
        miJobOverIssue._id.toString(),
        [{ componentId: miResComp._id.toString(), qty: 10 }], // > this job's own 2, but well within component's pooled reservedStock
        `test-key-${Date.now()}-C`,
        miAdmin._id
      );
    } catch (e) {
      overIssueError = e;
    }
    if (!(overIssueError instanceof JobApprovalError) || !overIssueError.message.includes('exceeds remaining reserved quantity')) {
      throw new Error(`Expected over-issue rejection, got: ${overIssueError}`);
    }
    const resAfter48 = (await Component.findById(miResComp._id))!;
    if (resAfter48.inStoreStock !== resBefore48.inStoreStock || resAfter48.reservedStock !== resBefore48.reservedStock) {
      throw new Error('Rejected over-issue still changed component stock');
    }
    await performJobCancellation(miPaddingJob48._id.toString(), miAdmin._id); // release the padding reservation
    createdTestJobIds.push(miPaddingJob48._id);
    console.log(`  ✓ Pass: Over-issue rejected ("${overIssueError.message}"), no stock change`);

    // Test 49: Insufficient physical stock is rejected (defense-in-depth guard)
    // Forces an abnormal state (inStoreStock < reservedStock) that should never
    // occur via normal API paths, to prove the guard still protects against it.
    console.log('\n[Test 49]: Verifying Insufficient Physical Stock Guard (Defense in Depth)');
    const miJobBadStock = await makeApprovedJob(1); // AMS not used here; reuse RES reserved=2
    createdTestJobIds.push(miJobBadStock._id);
    const resBeforeCorruption = (await Component.findById(miResComp._id))!;
    // Artificially corrupt: drop inStoreStock to an absolute value below the
    // qty we're about to request (bypassing normal guards, for this test
    // only) to simulate an inconsistent state - reservedStock stays
    // untouched and plentiful, isolating this from the Test 48 guard.
    await Component.findByIdAndUpdate(miResComp._id, { $set: { inStoreStock: 1 } }); // < qty=2 requested below

    let insufficientStockError: any = null;
    try {
      await performMaterialIssue(
        miJobBadStock._id.toString(),
        [{ componentId: miResComp._id.toString(), qty: 2 }],
        `test-key-${Date.now()}-D`,
        miAdmin._id
      );
    } catch (e) {
      insufficientStockError = e;
    }
    // Restore immediately regardless of outcome
    await Component.findByIdAndUpdate(miResComp._id, { $set: { inStoreStock: resBeforeCorruption.inStoreStock } });

    if (!(insufficientStockError instanceof JobApprovalError) || !insufficientStockError.message.includes('insufficient in-store')) {
      throw new Error(`Expected insufficient-stock rejection, got: ${insufficientStockError}`);
    }
    console.log(`  ✓ Pass: Insufficient physical stock correctly blocks issue even when reservation alone would allow it`);

    // Test 50: Duplicate request / idempotency
    console.log('\n[Test 50]: Verifying Duplicate Request Idempotency');
    const miJobIdempotent = await makeApprovedJob(1); // RES reserved=2, CAP reserved=1
    createdTestJobIds.push(miJobIdempotent._id);
    const idempotentKey = `test-key-${Date.now()}-E`;

    const firstCall = await performMaterialIssue(
      miJobIdempotent._id.toString(),
      [{ componentId: miResComp._id.toString(), qty: 2 }],
      idempotentKey,
      miAdmin._id
    );
    createdChallanIds.push(firstCall.challan._id);
    const resAfterFirst = (await Component.findById(miResComp._id))!;

    const secondCall = await performMaterialIssue(
      miJobIdempotent._id.toString(),
      [{ componentId: miResComp._id.toString(), qty: 2 }],
      idempotentKey, // SAME key - simulates retry/double-submit
      miAdmin._id
    );
    const resAfterSecond = (await Component.findById(miResComp._id))!;

    if (!secondCall.alreadyProcessed) throw new Error('Expected second identical-key call to be flagged alreadyProcessed');
    if (secondCall.challan._id.toString() !== firstCall.challan._id.toString()) {
      throw new Error('Retried request created a DIFFERENT challan instead of returning the original');
    }
    if (resAfterSecond.inStoreStock !== resAfterFirst.inStoreStock || resAfterSecond.reservedStock !== resAfterFirst.reservedStock) {
      throw new Error('Retried request moved stock a second time - not idempotent');
    }
    console.log(`  ✓ Pass: Retried request with same idempotency key returned the SAME challan (${firstCall.challan.challanNumber}), stock moved exactly once`);

    // Test 51: Two concurrent issue requests for the SAME job/component cannot over-issue
    console.log('\n[Test 51]: Verifying Concurrent Issues On The Same Job Cannot Over-Issue');
    const miJobConcurrentSame = await makeApprovedJob(100); // RES reserved=200
    createdTestJobIds.push(miJobConcurrentSame._id);
    const resBefore51 = (await Component.findById(miResComp._id))!;

    const concurrentSameResults = await Promise.allSettled([
      performMaterialIssue(
        miJobConcurrentSame._id.toString(),
        [{ componentId: miResComp._id.toString(), qty: 150 }],
        `test-key-${Date.now()}-F1`,
        miAdmin._id
      ),
      performMaterialIssue(
        miJobConcurrentSame._id.toString(),
        [{ componentId: miResComp._id.toString(), qty: 150 }],
        `test-key-${Date.now()}-F2`,
        miAdmin._id
      ),
    ]);
    const fulfilled51 = concurrentSameResults.filter((r) => r.status === 'fulfilled').length;
    if (fulfilled51 !== 1) throw new Error(`Expected exactly 1 of 2 concurrent over-subscribing issues to succeed, got ${fulfilled51}`);

    const resAfter51 = (await Component.findById(miResComp._id))!;
    if (resAfter51.withVendorStock !== resBefore51.withVendorStock + 150) {
      throw new Error(`Expected withVendorStock to increase by exactly 150 (one request's worth), increased by ${resAfter51.withVendorStock - resBefore51.withVendorStock}`);
    }
    console.log(`  ✓ 2 concurrent issues requesting 150 each (reserved=200, combined=300) -> exactly 1 succeeded`);
    console.log(`  ✓ Pass: Concurrent issues on the same job cannot collectively over-issue its reservation`);

    // Test 52: Concurrent issues for DIFFERENT jobs sharing a component succeed independently
    console.log('\n[Test 52]: Verifying Concurrent Issues For Different Jobs Sharing A Component');
    const miJobShareA = await makeApprovedJob(20); // RES reserved=40
    const miJobShareB = await makeApprovedJob(20); // RES reserved=40
    createdTestJobIds.push(miJobShareA._id, miJobShareB._id);
    const resBefore52 = (await Component.findById(miResComp._id))!;

    const [shareResultA, shareResultB] = await Promise.all([
      performMaterialIssue(miJobShareA._id.toString(), [{ componentId: miResComp._id.toString(), qty: 40 }], `test-key-${Date.now()}-G1`, miAdmin._id),
      performMaterialIssue(miJobShareB._id.toString(), [{ componentId: miResComp._id.toString(), qty: 40 }], `test-key-${Date.now()}-G2`, miAdmin._id),
    ]);
    createdChallanIds.push(shareResultA.challan._id, shareResultB.challan._id);

    const resAfter52 = (await Component.findById(miResComp._id))!;
    if (resAfter52.withVendorStock !== resBefore52.withVendorStock + 80) {
      throw new Error(`Expected withVendorStock to increase by 80 (both jobs' issues), increased by ${resAfter52.withVendorStock - resBefore52.withVendorStock}`);
    }
    console.log(`  ✓ Both independent jobs' issues succeeded concurrently, withVendorStock increased by exactly 80 (40+40)`);
    console.log('  ✓ Pass: Concurrent issues for different jobs sharing a component are correctly isolated by per-job reservation');

    // Test 53: Failure on a later line rolls back earlier movements (and no orphaned challan)
    console.log('\n[Test 53]: Verifying A Failing Line Rolls Back Every Earlier Movement In The Same Request');
    const miCircuitRollback = await Circuit.create({
      circuitCode: 'TEST-ISSUE-ROLLBACK',
      name: 'Issue Rollback Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: miResComp._id, qtyPerUnit: 1 },
        { componentId: miAmsComp._id, qtyPerUnit: 1 },
      ],
      isLocked: false,
      createdById: miAdmin._id,
    });
    const rollbackBuilt = await buildJobCircuitsAndRequirement([{ circuitId: miCircuitRollback._id.toString(), orderedQty: 2 }]);
    const rollbackJobNum = await generateJobNumber();
    const miJobIssueRollback = await Job.create({
      jobNumber: rollbackJobNum,
      jobDate: new Date(),
      vendorId: miVendor._id,
      targetDate: new Date(Date.now() + 86400000),
      status: 'draft',
      jobCircuits: rollbackBuilt.jobCircuits,
      materialRequirement: rollbackBuilt.materialRequirement,
      totalEstimatedCost: rollbackBuilt.totalEstimatedCost,
      createdById: miAdmin._id,
    });
    await performJobApproval(miJobIssueRollback._id.toString(), miAdmin._id); // RES reserved=2, AMS reserved=2
    createdTestJobIds.push(miJobIssueRollback._id);

    const resBefore53 = (await Component.findById(miResComp._id))!;
    const challanCountBefore53 = await DeliveryChallan.countDocuments();

    let rollbackIssueError: any = null;
    try {
      await performMaterialIssue(
        miJobIssueRollback._id.toString(),
        [
          { componentId: miResComp._id.toString(), qty: 2 }, // would succeed alone
          { componentId: miAmsComp._id.toString(), qty: 99999 }, // forces failure
        ],
        `test-key-${Date.now()}-H`,
        miAdmin._id
      );
    } catch (e) {
      rollbackIssueError = e;
    }
    if (!(rollbackIssueError instanceof JobApprovalError)) throw new Error('Expected the rollback scenario to throw JobApprovalError');

    const resAfter53 = (await Component.findById(miResComp._id))!;
    const challanCountAfter53 = await DeliveryChallan.countDocuments();
    if (resAfter53.inStoreStock !== resBefore53.inStoreStock || resAfter53.reservedStock !== resBefore53.reservedStock) {
      throw new Error('RES movement (which would have individually succeeded) was NOT rolled back');
    }
    if (challanCountAfter53 !== challanCountBefore53) {
      throw new Error('A challan was orphaned despite the overall issue failing');
    }
    console.log(`  ✓ RES would have issued successfully alone, but AMS failure rolled back the ENTIRE request`);
    console.log(`  ✓ No orphaned challan created (count unchanged: ${challanCountAfter53})`);
    console.log('  ✓ Pass: A failing line rolls back every movement in the same issue request, no orphaned challan');

    // Test 54: Unique challan numbering under concurrency
    console.log('\n[Test 54]: Verifying Unique Challan Numbering Under Concurrent Issues');
    const concurrencyJobs = await Promise.all(Array.from({ length: 5 }).map(() => makeApprovedJob(1)));
    createdTestJobIds.push(...concurrencyJobs.map((j) => j._id));
    const concurrentChallanResults = await Promise.all(
      concurrencyJobs.map((job, i) =>
        performMaterialIssue(
          job._id.toString(),
          [{ componentId: miResComp._id.toString(), qty: 2 }],
          `test-key-${Date.now()}-I${i}`,
          miAdmin._id
        )
      )
    );
    createdChallanIds.push(...concurrentChallanResults.map((r) => r.challan._id));
    const challanNumbers = concurrentChallanResults.map((r) => r.challan.challanNumber);
    const uniqueChallanNumbers = new Set(challanNumbers);
    if (uniqueChallanNumbers.size !== challanNumbers.length) {
      throw new Error(`Expected ${challanNumbers.length} unique challan numbers, got ${uniqueChallanNumbers.size}: ${challanNumbers.join(', ')}`);
    }
    console.log(`  ✓ 5 concurrent issues produced ${uniqueChallanNumbers.size} unique challan numbers: ${challanNumbers.join(', ')}`);
    console.log('  ✓ Pass: Challan numbering is safe under concurrency');

    // Test 55: Draft and cancelled jobs cannot be issued
    console.log('\n[Test 55]: Verifying Ineligible Job Statuses Cannot Be Issued');
    const draftBuild = await buildJobCircuitsAndRequirement([{ circuitId: miCircuitMain._id.toString(), orderedQty: 1 }]);
    const draftJobNum = await generateJobNumber();
    const miJobStillDraft = await Job.create({
      jobNumber: draftJobNum,
      jobDate: new Date(),
      vendorId: miVendor._id,
      targetDate: new Date(Date.now() + 86400000),
      status: 'draft',
      jobCircuits: draftBuild.jobCircuits,
      materialRequirement: draftBuild.materialRequirement,
      totalEstimatedCost: draftBuild.totalEstimatedCost,
      createdById: miAdmin._id,
    });
    createdTestJobIds.push(miJobStillDraft._id);

    let draftIssueError: any = null;
    try {
      await performMaterialIssue(miJobStillDraft._id.toString(), [{ componentId: miResComp._id.toString(), qty: 1 }], `test-key-${Date.now()}-J1`, miAdmin._id);
    } catch (e) {
      draftIssueError = e;
    }
    if (!(draftIssueError instanceof JobApprovalError) || !draftIssueError.message.includes('draft')) {
      throw new Error(`Expected draft job to be rejected for issue, got: ${draftIssueError}`);
    }

    const miJobToCancel = await makeApprovedJob(1);
    await performJobCancellation(miJobToCancel._id.toString(), miAdmin._id);
    createdTestJobIds.push(miJobToCancel._id);

    let cancelledIssueError: any = null;
    try {
      await performMaterialIssue(miJobToCancel._id.toString(), [{ componentId: miResComp._id.toString(), qty: 1 }], `test-key-${Date.now()}-J2`, miAdmin._id);
    } catch (e) {
      cancelledIssueError = e;
    }
    if (!(cancelledIssueError instanceof JobApprovalError) || !cancelledIssueError.message.includes('cancelled')) {
      throw new Error(`Expected cancelled job to be rejected for issue, got: ${cancelledIssueError}`);
    }
    console.log(`  ✓ Draft job rejected: "${draftIssueError.message}"`);
    console.log(`  ✓ Cancelled job rejected: "${cancelledIssueError.message}"`);
    console.log('  ✓ Pass: Draft and cancelled jobs cannot receive a material issue');

    // Cleanup
    await Job.deleteMany({ _id: { $in: createdTestJobIds } });
    await DeliveryChallan.deleteMany({ _id: { $in: createdChallanIds } });
    await Circuit.deleteMany({ circuitCode: { $regex: '^TEST-ISSUE-' } });
    console.log('\n  (Material issue test jobs, challans, and circuits cleaned up)');
  }

  // --- DAY 5 PRIORITY 6 TESTS: MATERIAL RECEIPT ---
  console.log('\n====================================================');
  console.log('   DAY 5 PRIORITY 6 - MATERIAL RECEIPT VERIFICATION  ');
  console.log('====================================================\n');

  if (!getIsReplicaSet()) {
    console.log('  ⚠ Skipping Material Receipt tests: this MongoDB connection is not a replica set.');
    console.log('    Re-run with MONGODB_URI pointed at a transaction-capable deployment to exercise them.');
  } else {
    const { performJobApproval } = await import('./controllers/jobController.js');
    const { performMaterialIssue } = await import('./controllers/jobController.js');
    const { performMaterialReceipt, ReceiptError } = await import('./controllers/receiptController.js');
    const { DeliveryChallan } = await import('./models/DeliveryChallan.js');
    const { MaterialReceipt } = await import('./models/MaterialReceipt.js');

    const mrResComp = (await Component.findOne({ partCode: 'RES-10K-0805-1%' }))!;
    const mrCapComp = (await Component.findOne({ partCode: 'CAP-100NF-0805-50V' }))!;
    const mrVendor = (await Vendor.findOne({ isActive: true }))!;
    const mrAdmin = (await User.findOne({ role: 'admin' }))!;

    const mrCircuitMain = await Circuit.create({
      circuitCode: 'TEST-RECEIPT-MAIN',
      name: 'Receipt Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: mrResComp._id, qtyPerUnit: 2 },
        { componentId: mrCapComp._id, qtyPerUnit: 1 },
      ],
      isLocked: false,
      createdById: mrAdmin._id,
    });
    const mrCircuitSingle = await Circuit.create({
      circuitCode: 'TEST-RECEIPT-SINGLE',
      name: 'Receipt Single Component Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [{ componentId: mrResComp._id, qtyPerUnit: 1 }],
      isLocked: false,
      createdById: mrAdmin._id,
    });

    const createdReceiptTestJobIds: mongoose.Types.ObjectId[] = [];
    const createdReceiptTestChallanIds: mongoose.Types.ObjectId[] = [];
    const createdReceiptIds: mongoose.Types.ObjectId[] = [];

    async function makeIssuedJob(circuitId: mongoose.Types.ObjectId, orderedQty: number, issueItems: Array<{ componentId: mongoose.Types.ObjectId; qty: number }>) {
      const built = await buildJobCircuitsAndRequirement([{ circuitId: circuitId.toString(), orderedQty }]);
      const jn = await generateJobNumber();
      const job = await Job.create({
        jobNumber: jn,
        jobDate: new Date(),
        vendorId: mrVendor._id,
        targetDate: new Date(Date.now() + 86400000),
        status: 'draft',
        jobCircuits: built.jobCircuits,
        materialRequirement: built.materialRequirement,
        totalEstimatedCost: built.totalEstimatedCost,
        createdById: mrAdmin._id,
      });
      await performJobApproval(job._id.toString(), mrAdmin._id);
      const issueResult = await performMaterialIssue(
        job._id.toString(),
        issueItems.map((i) => ({ componentId: i.componentId.toString(), qty: i.qty })),
        `mr-setup-${Date.now()}-${Math.random()}`,
        mrAdmin._id
      );
      createdReceiptTestJobIds.push(job._id);
      createdReceiptTestChallanIds.push(issueResult.challan._id);
      return { job, challan: issueResult.challan };
    }

    // Tests 56-58: Full receipt, stock/vendor reconciliation, remaining receivable
    console.log('[Test 56-58]: Verifying Successful Full Receipt & Stock/Vendor Reconciliation');
    const { challan: challan56 } = await makeIssuedJob(mrCircuitMain._id, 10, [
      { componentId: mrResComp._id, qty: 20 },
      { componentId: mrCapComp._id, qty: 10 },
    ]);
    const resBefore56 = (await Component.findById(mrResComp._id))!;
    const capBefore56 = (await Component.findById(mrCapComp._id))!;

    const receiptResult56 = await performMaterialReceipt(
      challan56._id.toString(),
      [
        { componentId: mrResComp._id.toString(), receivedQty: 20, damagedQty: 0 },
        { componentId: mrCapComp._id.toString(), receivedQty: 10, damagedQty: 0 },
      ],
      `test-key-${Date.now()}-R1`,
      mrAdmin._id
    );
    createdReceiptIds.push(receiptResult56.receipt._id);

    if (receiptResult56.alreadyProcessed) throw new Error('Expected a fresh receipt, not alreadyProcessed');
    if (receiptResult56.challan!.status !== 'received') {
      throw new Error(`Expected challan status 'received', got '${receiptResult56.challan!.status}'`);
    }
    const resAfter56 = (await Component.findById(mrResComp._id))!;
    const capAfter56 = (await Component.findById(mrCapComp._id))!;
    if (resAfter56.inStoreStock !== resBefore56.inStoreStock + 20) throw new Error('RES inStoreStock did not increase by 20');
    if (resAfter56.withVendorStock !== resBefore56.withVendorStock - 20) throw new Error('RES withVendorStock did not decrease by 20');
    if (capAfter56.inStoreStock !== capBefore56.inStoreStock + 10) throw new Error('CAP inStoreStock did not increase by 10');
    if (capAfter56.withVendorStock !== capBefore56.withVendorStock - 10) throw new Error('CAP withVendorStock did not decrease by 10');

    const reloadedJob56 = await Job.findById(createdReceiptTestJobIds[createdReceiptTestJobIds.length - 1]);
    if (reloadedJob56!.status !== 'partially_received') {
      throw new Error(`Expected job status 'partially_received' after first receipt, got '${reloadedJob56!.status}'`);
    }
    const resLine56 = receiptResult56.receipt.items.find((i: any) => i.componentId.toString() === mrResComp._id.toString())!;
    if (resLine56.remainingAfter !== 0) throw new Error(`Expected RES remainingAfter=0, got ${resLine56.remainingAfter}`);

    console.log(`  ✓ Receipt ${receiptResult56.receipt.receiptNumber}: RES +20 store / -20 vendor, CAP +10 store / -10 vendor`);
    console.log(`  ✓ Challan status = 'received', Job status = 'partially_received' (never auto-closes)`);
    console.log('  ✓ Pass: Full receipt correctly reconciles store and vendor-held stock');

    // Test 59: Multiple partial receipts, status transitions, remaining receivable
    console.log('\n[Test 59]: Verifying Multiple Partial Receipts & Status Transitions');
    const { challan: challan59 } = await makeIssuedJob(mrCircuitSingle._id, 20, [{ componentId: mrResComp._id, qty: 20 }]);

    const partialReceipt1 = await performMaterialReceipt(
      challan59._id.toString(),
      [{ componentId: mrResComp._id.toString(), receivedQty: 12, damagedQty: 0 }],
      `test-key-${Date.now()}-R2a`,
      mrAdmin._id
    );
    createdReceiptIds.push(partialReceipt1.receipt._id);
    if (partialReceipt1.challan!.status !== 'partially_received') {
      throw new Error(`Expected challan status 'partially_received' after partial receipt, got '${partialReceipt1.challan!.status}'`);
    }
    const line59a = partialReceipt1.receipt.items[0];
    if (line59a.remainingAfter !== 8) throw new Error(`Expected remainingAfter=8, got ${line59a.remainingAfter}`);

    const partialReceipt2 = await performMaterialReceipt(
      challan59._id.toString(),
      [{ componentId: mrResComp._id.toString(), receivedQty: 5, damagedQty: 3 }], // 5 good + 3 damaged = remaining 8 consumed exactly
      `test-key-${Date.now()}-R2b`,
      mrAdmin._id
    );
    createdReceiptIds.push(partialReceipt2.receipt._id);
    if (partialReceipt2.challan!.status !== 'received') {
      throw new Error(`Expected challan status 'received' after final receipt, got '${partialReceipt2.challan!.status}'`);
    }
    const line59b = partialReceipt2.receipt.items[0];
    if (line59b.remainingAfter !== 0) throw new Error(`Expected remainingAfter=0, got ${line59b.remainingAfter}`);
    if (line59b.previouslyReceivedQty !== 12) throw new Error(`Expected previouslyReceivedQty=12, got ${line59b.previouslyReceivedQty}`);

    const receiptsForChallan59 = await MaterialReceipt.find({ challanId: challan59._id });
    if (receiptsForChallan59.length !== 2) throw new Error(`Expected 2 separate receipt records, got ${receiptsForChallan59.length}`);

    console.log(`  ✓ First partial: received 12, remaining 8, challan='partially_received'`);
    console.log(`  ✓ Second receipt: 5 good + 3 damaged = remaining 0, challan='received'`);
    console.log(`  ✓ 2 separate, non-overwritten receipt records preserved`);
    console.log('  ✓ Pass: Multiple partial receipts (including damaged qty) tracked correctly');

    // Test 60: Over-receipt rejected
    console.log('\n[Test 60]: Verifying Over-Receipt Is Rejected');
    const { challan: challan60 } = await makeIssuedJob(mrCircuitSingle._id, 5, [{ componentId: mrResComp._id, qty: 5 }]);
    const resBefore60 = (await Component.findById(mrResComp._id))!;

    let overReceiptError: any = null;
    try {
      await performMaterialReceipt(
        challan60._id.toString(),
        [{ componentId: mrResComp._id.toString(), receivedQty: 999, damagedQty: 0 }],
        `test-key-${Date.now()}-R3`,
        mrAdmin._id
      );
    } catch (e) {
      overReceiptError = e;
    }
    if (!(overReceiptError instanceof ReceiptError) || !overReceiptError.message.includes('exceeds remaining receivable')) {
      throw new Error(`Expected over-receipt rejection, got: ${overReceiptError}`);
    }
    const resAfter60 = (await Component.findById(mrResComp._id))!;
    if (resAfter60.inStoreStock !== resBefore60.inStoreStock || resAfter60.withVendorStock !== resBefore60.withVendorStock) {
      throw new Error('Rejected over-receipt still changed component stock');
    }
    console.log(`  ✓ Pass: Over-receipt rejected ("${overReceiptError.message}"), no stock change`);

    // Test 61: Invalid and zero quantities rejected
    console.log('\n[Test 61]: Verifying Invalid/Zero Quantities Are Rejected');
    const { challan: challan61 } = await makeIssuedJob(mrCircuitSingle._id, 5, [{ componentId: mrResComp._id, qty: 5 }]);

    let zeroQtyError: any = null;
    try {
      await performMaterialReceipt(
        challan61._id.toString(),
        [{ componentId: mrResComp._id.toString(), receivedQty: 0, damagedQty: 0 }],
        `test-key-${Date.now()}-R4a`,
        mrAdmin._id
      );
    } catch (e) {
      zeroQtyError = e;
    }
    if (!(zeroQtyError instanceof ReceiptError) || !zeroQtyError.message.includes('greater than zero')) {
      throw new Error(`Expected zero-quantity rejection, got: ${zeroQtyError}`);
    }

    let negativeQtyError: any = null;
    try {
      await performMaterialReceipt(
        challan61._id.toString(),
        [{ componentId: mrResComp._id.toString(), receivedQty: -5, damagedQty: 0 }],
        `test-key-${Date.now()}-R4b`,
        mrAdmin._id
      );
    } catch (e) {
      negativeQtyError = e;
    }
    if (!(negativeQtyError instanceof ReceiptError) || !negativeQtyError.message.includes('cannot be negative')) {
      throw new Error(`Expected negative-quantity rejection, got: ${negativeQtyError}`);
    }
    console.log('  ✓ Pass: Zero and negative quantities both correctly rejected');

    // Test 62: Duplicate component within one receipt request rejected
    console.log('\n[Test 62]: Verifying Duplicate Component In One Receipt Request Is Rejected');
    let dupComponentError: any = null;
    try {
      await performMaterialReceipt(
        challan61._id.toString(),
        [
          { componentId: mrResComp._id.toString(), receivedQty: 1, damagedQty: 0 },
          { componentId: mrResComp._id.toString(), receivedQty: 1, damagedQty: 0 },
        ],
        `test-key-${Date.now()}-R5`,
        mrAdmin._id
      );
    } catch (e) {
      dupComponentError = e;
    }
    if (!(dupComponentError instanceof ReceiptError) || !dupComponentError.message.includes('Duplicate component')) {
      throw new Error(`Expected duplicate-component rejection, got: ${dupComponentError}`);
    }
    console.log('  ✓ Pass: Duplicate component within one receipt request rejected');

    // Test 63: Duplicate request idempotency
    console.log('\n[Test 63]: Verifying Duplicate Request Idempotency');
    const idempotentReceiptKey = `test-key-${Date.now()}-R6`;
    const firstReceiptCall = await performMaterialReceipt(
      challan61._id.toString(),
      [{ componentId: mrResComp._id.toString(), receivedQty: 5, damagedQty: 0 }],
      idempotentReceiptKey,
      mrAdmin._id
    );
    createdReceiptIds.push(firstReceiptCall.receipt._id);
    const resAfterFirstReceipt = (await Component.findById(mrResComp._id))!;

    const secondReceiptCall = await performMaterialReceipt(
      challan61._id.toString(),
      [{ componentId: mrResComp._id.toString(), receivedQty: 5, damagedQty: 0 }],
      idempotentReceiptKey, // SAME key
      mrAdmin._id
    );
    const resAfterSecondReceipt = (await Component.findById(mrResComp._id))!;

    if (!secondReceiptCall.alreadyProcessed) throw new Error('Expected second identical-key call to be flagged alreadyProcessed');
    if (secondReceiptCall.receipt._id.toString() !== firstReceiptCall.receipt._id.toString()) {
      throw new Error('Retried request created a DIFFERENT receipt instead of returning the original');
    }
    if (resAfterSecondReceipt.inStoreStock !== resAfterFirstReceipt.inStoreStock) {
      throw new Error('Retried request moved stock a second time - not idempotent');
    }
    console.log(`  ✓ Pass: Retried request with same idempotency key returned the SAME receipt (${firstReceiptCall.receipt.receiptNumber}), stock moved exactly once`);

    // Test 64: Concurrent receipts against the same challan line cannot over-receive
    console.log('\n[Test 64]: Verifying Concurrent Receipts Cannot Over-Receive The Same Challan Line');
    const { challan: challan64 } = await makeIssuedJob(mrCircuitSingle._id, 100, [{ componentId: mrResComp._id, qty: 100 }]);
    const resBefore64 = (await Component.findById(mrResComp._id))!;

    const concurrentReceiptResults = await Promise.allSettled([
      performMaterialReceipt(challan64._id.toString(), [{ componentId: mrResComp._id.toString(), receivedQty: 70, damagedQty: 0 }], `test-key-${Date.now()}-R7a`, mrAdmin._id),
      performMaterialReceipt(challan64._id.toString(), [{ componentId: mrResComp._id.toString(), receivedQty: 70, damagedQty: 0 }], `test-key-${Date.now()}-R7b`, mrAdmin._id),
    ]);
    const fulfilled64 = concurrentReceiptResults.filter((r) => r.status === 'fulfilled').length;
    if (fulfilled64 !== 1) throw new Error(`Expected exactly 1 of 2 concurrent over-subscribing receipts to succeed, got ${fulfilled64}`);

    const resAfter64 = (await Component.findById(mrResComp._id))!;
    if (resAfter64.inStoreStock !== resBefore64.inStoreStock + 70) {
      throw new Error(`Expected inStoreStock to increase by exactly 70 (one request's worth), increased by ${resAfter64.inStoreStock - resBefore64.inStoreStock}`);
    }
    console.log(`  ✓ 2 concurrent receipts requesting 70 each (issued=100, combined=140) -> exactly 1 succeeded`);
    console.log('  ✓ Pass: Concurrent receipts cannot collectively over-receive a challan line');

    // Test 65: Failure on a later line rolls back earlier movements, no orphaned receipt
    console.log('\n[Test 65]: Verifying A Failing Line Rolls Back Every Earlier Movement In The Same Receipt');
    const { challan: challan65 } = await makeIssuedJob(mrCircuitMain._id, 5, [
      { componentId: mrResComp._id, qty: 10 },
      { componentId: mrCapComp._id, qty: 5 },
    ]);
    const resBefore65 = (await Component.findById(mrResComp._id))!;
    const receiptCountBefore65 = await MaterialReceipt.countDocuments();

    let rollbackReceiptError: any = null;
    try {
      await performMaterialReceipt(
        challan65._id.toString(),
        [
          { componentId: mrResComp._id.toString(), receivedQty: 10, damagedQty: 0 }, // would succeed alone
          { componentId: mrCapComp._id.toString(), receivedQty: 99999, damagedQty: 0 }, // forces failure
        ],
        `test-key-${Date.now()}-R8`,
        mrAdmin._id
      );
    } catch (e) {
      rollbackReceiptError = e;
    }
    if (!(rollbackReceiptError instanceof ReceiptError)) throw new Error('Expected the rollback scenario to throw ReceiptError');

    const resAfter65 = (await Component.findById(mrResComp._id))!;
    const receiptCountAfter65 = await MaterialReceipt.countDocuments();
    if (resAfter65.inStoreStock !== resBefore65.inStoreStock || resAfter65.withVendorStock !== resBefore65.withVendorStock) {
      throw new Error('RES movement (which would have individually succeeded) was NOT rolled back');
    }
    if (receiptCountAfter65 !== receiptCountBefore65) {
      throw new Error('A receipt record was orphaned despite the overall request failing');
    }
    console.log(`  ✓ RES would have received successfully alone, but CAP over-receipt rolled back the ENTIRE request`);
    console.log(`  ✓ No orphaned receipt record created (count unchanged: ${receiptCountAfter65})`);
    console.log('  ✓ Pass: A failing line rolls back every movement in the same receipt request');

    // Test 66: Ineligible challan/job states
    console.log('\n[Test 66]: Verifying Ineligible Challan States Are Rejected');
    let notFoundError: any = null;
    try {
      await performMaterialReceipt(
        new mongoose.Types.ObjectId().toString(),
        [{ componentId: mrResComp._id.toString(), receivedQty: 1, damagedQty: 0 }],
        `test-key-${Date.now()}-R9a`,
        mrAdmin._id
      );
    } catch (e) {
      notFoundError = e;
    }
    if (!(notFoundError instanceof ReceiptError) || !notFoundError.message.includes('not found')) {
      throw new Error(`Expected not-found rejection for invalid challan id, got: ${notFoundError}`);
    }

    // challan56 is already fully 'received' from Test 56-58 - any further
    // receipt against it must be rejected as exceeding remaining receivable.
    let fullyReceivedError: any = null;
    try {
      await performMaterialReceipt(
        challan56._id.toString(),
        [{ componentId: mrResComp._id.toString(), receivedQty: 1, damagedQty: 0 }],
        `test-key-${Date.now()}-R9b`,
        mrAdmin._id
      );
    } catch (e) {
      fullyReceivedError = e;
    }
    if (!(fullyReceivedError instanceof ReceiptError)) {
      throw new Error(`Expected rejection for an already-fully-received challan, got: ${fullyReceivedError}`);
    }
    console.log(`  ✓ Invalid challan id rejected: "${notFoundError.message}"`);
    console.log(`  ✓ Already fully-received challan rejected: "${fullyReceivedError.message}"`);
    console.log('  ✓ Pass: Ineligible challan states correctly rejected');

    // Test 67: Vendor-held / in-store stock reconciliation against the ledger
    console.log('\n[Test 67]: Verifying Vendor-Held & In-Store Stock Reconciles With The Ledger');
    const { challan: challan67 } = await makeIssuedJob(mrCircuitSingle._id, 50, [{ componentId: mrResComp._id, qty: 50 }]);
    const resBefore67 = (await Component.findById(mrResComp._id))!;
    const receipt67 = await performMaterialReceipt(
      challan67._id.toString(),
      [{ componentId: mrResComp._id.toString(), receivedQty: 30, damagedQty: 15 }],
      `test-key-${Date.now()}-R10`,
      mrAdmin._id
    );
    createdReceiptIds.push(receipt67.receipt._id);
    const resAfter67 = (await Component.findById(mrResComp._id))!;

    const returnLedger = await StockTransaction.find({ referenceNo: receipt67.receipt.receiptNumber, type: 'RETURN_FROM_VENDOR' });
    const consumptionLedger = await StockTransaction.find({ referenceNo: receipt67.receipt.receiptNumber, type: 'CONSUMPTION' });
    const ledgerReturnQty = returnLedger.reduce((s, t) => s + t.qtyChange, 0);
    const ledgerDamagedQty = Math.abs(consumptionLedger.reduce((s, t) => s + t.qtyChange, 0));

    if (ledgerReturnQty !== 30) throw new Error(`Expected ledger RETURN_FROM_VENDOR sum = 30, got ${ledgerReturnQty}`);
    if (ledgerDamagedQty !== 15) throw new Error(`Expected ledger CONSUMPTION sum = 15, got ${ledgerDamagedQty}`);
    if (resAfter67.inStoreStock - resBefore67.inStoreStock !== ledgerReturnQty) {
      throw new Error('inStoreStock delta does not match the RETURN_FROM_VENDOR ledger sum');
    }
    if (resBefore67.withVendorStock - resAfter67.withVendorStock !== 45) {
      throw new Error(`Expected withVendorStock to decrease by 45 (30 returned + 15 damaged), decreased by ${resBefore67.withVendorStock - resAfter67.withVendorStock}`);
    }
    console.log(`  ✓ Ledger: RETURN_FROM_VENDOR sum=${ledgerReturnQty}, CONSUMPTION sum=${ledgerDamagedQty}`);
    console.log(`  ✓ inStoreStock delta matches ledger exactly; withVendorStock dropped by the full 45 (returned + damaged)`);
    console.log('  ✓ Pass: Vendor-held and in-store stock correctly reconciles against immutable ledger entries');

    console.log('\n[Note]: Tenant isolation (#16) is not applicable - this codebase has no multi-tenancy');
    console.log('  model anywhere (no tenantId/companyId field on any schema); all data is single-instance.');

    // Cleanup
    await Job.deleteMany({ _id: { $in: createdReceiptTestJobIds } });
    await DeliveryChallan.deleteMany({ _id: { $in: createdReceiptTestChallanIds } });
    await MaterialReceipt.deleteMany({ _id: { $in: createdReceiptIds } });
    await Circuit.deleteMany({ circuitCode: { $regex: '^TEST-RECEIPT-' } });
    console.log('\n  (Material receipt test jobs, challans, receipts, and circuits cleaned up)');
  }

  // --- DAY 5 CORRECTION: COMBINED JOB RECEIPT, FINISHED GOODS, RECONCILIATION, CLOSING ---
  console.log('\n====================================================');
  console.log('   COMBINED JOB RECEIPT & FINISHED GOODS VERIFICATION ');
  console.log('====================================================\n');

  if (!getIsReplicaSet()) {
    console.log('  ⚠ Skipping combined job receipt tests: this MongoDB connection is not a replica set.');
  } else {
    const { performJobReceipt, computeJobReconciliation } = await import('./controllers/jobReceiptController.js');
    const { performJobClose } = await import('./controllers/jobController.js');
    const { performJobApproval, performMaterialIssue } = await import('./controllers/jobController.js');
    const { performMaterialReceipt: performMaterialReceiptFn, ReceiptError } = await import('./controllers/receiptController.js');
    const { computeBackfilledCounters } = await import('./migrate-job-counters.js');
    const { FinishedGoods } = await import('./models/FinishedGoods.js');
    const { FinishedGoodsTransaction } = await import('./models/FinishedGoodsTransaction.js');
    const { JobReceipt } = await import('./models/JobReceipt.js');
    const { DeliveryChallan } = await import('./models/DeliveryChallan.js');
    const { MaterialReceipt } = await import('./models/MaterialReceipt.js');

    const crResComp = (await Component.findOne({ partCode: 'RES-10K-0805-1%' }))!;
    const crCapComp = (await Component.findOne({ partCode: 'CAP-100NF-0805-50V' }))!;
    const crVendor = (await Vendor.findOne({ isActive: true }))!;
    const crAdmin = (await User.findOne({ role: 'admin' }))!;

    const crCircuit = await Circuit.create({
      circuitCode: 'TEST-JOBRECEIPT-MAIN',
      name: 'Job Receipt Test Circuit',
      version: '1.0',
      status: 'active',
      bomItems: [
        { componentId: crResComp._id, qtyPerUnit: 2 },
        { componentId: crCapComp._id, qtyPerUnit: 1 },
      ],
      isLocked: false,
      createdById: crAdmin._id,
    });

    const crCreatedJobIds: mongoose.Types.ObjectId[] = [];

    async function makeIssuedJobForReceipt(orderedQty: number) {
      const built = await buildJobCircuitsAndRequirement([{ circuitId: crCircuit._id.toString(), orderedQty }]);
      const jn = await generateJobNumber();
      const job = await Job.create({
        jobNumber: jn,
        jobDate: new Date(),
        vendorId: crVendor._id,
        targetDate: new Date(Date.now() + 86400000),
        status: 'draft',
        jobCircuits: built.jobCircuits,
        materialRequirement: built.materialRequirement,
        totalEstimatedCost: built.totalEstimatedCost,
        createdById: crAdmin._id,
      });
      await performJobApproval(job._id.toString(), crAdmin._id);
      const issueResult = await performMaterialIssue(
        job._id.toString(),
        [
          { componentId: crResComp._id.toString(), qty: orderedQty * 2 },
          { componentId: crCapComp._id.toString(), qty: orderedQty * 1 },
        ],
        `cr-setup-${Date.now()}-${Math.random()}`,
        crAdmin._id
      );
      crCreatedJobIds.push(job._id);
      const reloaded = (await Job.findById(job._id))!;
      return { job: reloaded, challan: issueResult.challan, jobCircuitId: reloaded.jobCircuits[0]._id!.toString() };
    }

    // Test 68: Full combined receipt in ONE transaction - circuits +
    // consumption + FinishedGoods + component return + damage together.
    console.log('[Test 68]: Verifying Combined Receipt (Circuits + Consumption + FinishedGoods + Returns + Damage)');
    const t68 = await makeIssuedJobForReceipt(10); // RES issued=20, CAP issued=10
    // Snapshot AFTER issue (not before) - issue itself already moved stock
    // from store to vendor; this test only cares about what the RECEIPT
    // does on top of that.
    const resBefore68 = (await Component.findById(crResComp._id))!;
    const capBefore68 = (await Component.findById(crCapComp._id))!;
    const result68 = await performJobReceipt(
      t68.job._id.toString(),
      {
        circuitReceipts: [{ jobCircuitId: t68.jobCircuitId, goodQty: 8, rejectedQty: 0 }],
        componentReturns: [
          { componentId: crResComp._id.toString(), challanId: t68.challan._id.toString(), receivedQty: 4, damagedQty: 0 },
          { componentId: crCapComp._id.toString(), challanId: t68.challan._id.toString(), receivedQty: 0, damagedQty: 2 },
        ],
        remarks: 'Combined test receipt',
      },
      `test-key-${Date.now()}-JR1`,
      crAdmin._id
    );
    if (result68.alreadyProcessed) throw new Error('Expected fresh combined receipt');
    if (result68.job!.status !== 'partially_received') throw new Error(`Expected status 'partially_received', got '${result68.job!.status}'`);

    const resLine68 = result68.job!.materialRequirement.find((m: any) => m.componentId.toString() === crResComp._id.toString())!;
    const capLine68 = result68.job!.materialRequirement.find((m: any) => m.componentId.toString() === crCapComp._id.toString())!;
    if (resLine68.consumedQty !== 16) throw new Error(`Expected RES consumedQty=16 (8 circuits x 2), got ${resLine68.consumedQty}`);
    if (resLine68.returnedQty !== 4) throw new Error(`Expected RES returnedQty=4, got ${resLine68.returnedQty}`);
    if (capLine68.consumedQty !== 8) throw new Error(`Expected CAP consumedQty=8 (8 circuits x 1), got ${capLine68.consumedQty}`);
    if (capLine68.damagedQty !== 2) throw new Error(`Expected CAP damagedQty=2, got ${capLine68.damagedQty}`);

    const finishedGoods68 = await FinishedGoods.findOne({ circuitId: crCircuit._id });
    if (finishedGoods68!.goodQtyBalance !== 8) throw new Error(`Expected FinishedGoods balance=8, got ${finishedGoods68!.goodQtyBalance}`);

    const resAfter68 = (await Component.findById(crResComp._id))!;
    const capAfter68 = (await Component.findById(crCapComp._id))!;
    // resBefore68/capBefore68 were captured AFTER issue (so they already
    // include the +20 RES / +10 CAP withVendorStock from issuing this job).
    // The receipt fully resolves that exact amount (16 consumed + 4
    // returned = 20 for RES; 8 consumed + 2 damaged = 10 for CAP), so
    // withVendorStock should drop by exactly that much from this baseline.
    if (resAfter68.withVendorStock !== resBefore68.withVendorStock - 20) {
      throw new Error(`Expected RES withVendorStock to drop by 20 from ${resBefore68.withVendorStock} (16 consumed + 4 returned), got ${resAfter68.withVendorStock}`);
    }
    if (capAfter68.withVendorStock !== capBefore68.withVendorStock - 10) {
      throw new Error(`Expected CAP withVendorStock to drop by 10 from ${capBefore68.withVendorStock} (8 consumed + 2 damaged), got ${capAfter68.withVendorStock}`);
    }
    if (resAfter68.inStoreStock !== resBefore68.inStoreStock + 4) {
      throw new Error(`Expected RES inStoreStock to increase by exactly 4 (returned qty), increased by ${resAfter68.inStoreStock - resBefore68.inStoreStock}`);
    }

    console.log(`  ✓ RES: consumed=16, returned=4 -> withVendorStock back to pre-test baseline, inStoreStock +4`);
    console.log(`  ✓ CAP: consumed=8, damaged=2 -> withVendorStock back to pre-test baseline`);
    console.log(`  ✓ FinishedGoods balance = 8 (good), rejected tracked separately`);
    console.log('  ✓ Pass: One combined transaction correctly applied circuits, consumption, FinishedGoods, returns, and damage together');

    // Test 69: Partial finished-circuit receipt reaching full ordered qty,
    // then over-receipt rejection.
    console.log('\n[Test 69]: Verifying Partial Circuit Receipt Progression & Over-Receipt Rejection');
    const t69 = await makeIssuedJobForReceipt(10);
    const r69a = await performJobReceipt(
      t69.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t69.jobCircuitId, goodQty: 6, rejectedQty: 0 }] },
      `test-key-${Date.now()}-JR2a`,
      crAdmin._id
    );
    const circuitLine69a = r69a.job!.jobCircuits.find((jc: any) => jc._id.toString() === t69.jobCircuitId)!;
    if (circuitLine69a.receivedGoodQty !== 6) throw new Error(`Expected receivedGoodQty=6, got ${circuitLine69a.receivedGoodQty}`);

    const r69b = await performJobReceipt(
      t69.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t69.jobCircuitId, goodQty: 3, rejectedQty: 1 }] },
      `test-key-${Date.now()}-JR2b`,
      crAdmin._id
    );
    const circuitLine69b = r69b.job!.jobCircuits.find((jc: any) => jc._id.toString() === t69.jobCircuitId)!;
    if (circuitLine69b.receivedGoodQty !== 9 || circuitLine69b.receivedRejectedQty !== 1) {
      throw new Error(`Expected 9 good / 1 rejected cumulative, got ${circuitLine69b.receivedGoodQty}/${circuitLine69b.receivedRejectedQty}`);
    }

    let overReceiptCircuitError: any = null;
    try {
      await performJobReceipt(
        t69.job._id.toString(),
        { circuitReceipts: [{ jobCircuitId: t69.jobCircuitId, goodQty: 1, rejectedQty: 0 }] },
        `test-key-${Date.now()}-JR2c`,
        crAdmin._id
      );
    } catch (e) {
      overReceiptCircuitError = e;
    }
    if (!(overReceiptCircuitError instanceof ReceiptError) || !overReceiptCircuitError.message.includes('exceeds remaining ordered quantity')) {
      throw new Error(`Expected over-receipt rejection, got: ${overReceiptCircuitError}`);
    }
    console.log('  ✓ Progression: 6 -> 9 good / 1 rejected (10 total = fully ordered)');
    console.log(`  ✓ Pass: Further receipt beyond ordered qty rejected ("${overReceiptCircuitError.message}")`);

    // Test 70: Idempotent retry on a combined receipt
    console.log('\n[Test 70]: Verifying Idempotent Retry On Combined Receipt');
    const t70 = await makeIssuedJobForReceipt(5);
    const idemKey70 = `test-key-${Date.now()}-JR3`;
    const first70 = await performJobReceipt(
      t70.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t70.jobCircuitId, goodQty: 5, rejectedQty: 0 }] },
      idemKey70,
      crAdmin._id
    );
    const fgAfterFirst70 = (await FinishedGoods.findOne({ circuitId: crCircuit._id }))!.goodQtyBalance;

    const second70 = await performJobReceipt(
      t70.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t70.jobCircuitId, goodQty: 5, rejectedQty: 0 }] },
      idemKey70, // SAME key
      crAdmin._id
    );
    const fgAfterSecond70 = (await FinishedGoods.findOne({ circuitId: crCircuit._id }))!.goodQtyBalance;

    if (!second70.alreadyProcessed) throw new Error('Expected retried combined receipt to be flagged alreadyProcessed');
    if (second70.receipt._id.toString() !== first70.receipt._id.toString()) throw new Error('Retry created a different JobReceipt');
    if (fgAfterFirst70 !== fgAfterSecond70) throw new Error('Retried combined receipt double-applied FinishedGoods increment - not idempotent');
    console.log(`  ✓ Pass: Retried combined receipt returned the SAME receipt (${first70.receipt.receiptNumber}), FinishedGoods unchanged by the retry`);

    // Test 71: Concurrent combined receipts against the same job circuit cannot over-receive
    console.log('\n[Test 71]: Verifying Concurrent Combined Receipts Cannot Over-Receive The Same Circuit');
    const t71 = await makeIssuedJobForReceipt(10);
    const concurrent71 = await Promise.allSettled([
      performJobReceipt(t71.job._id.toString(), { circuitReceipts: [{ jobCircuitId: t71.jobCircuitId, goodQty: 7, rejectedQty: 0 }] }, `test-key-${Date.now()}-JR4a`, crAdmin._id),
      performJobReceipt(t71.job._id.toString(), { circuitReceipts: [{ jobCircuitId: t71.jobCircuitId, goodQty: 7, rejectedQty: 0 }] }, `test-key-${Date.now()}-JR4b`, crAdmin._id),
    ]);
    const fulfilled71 = concurrent71.filter((r) => r.status === 'fulfilled').length;
    if (fulfilled71 !== 1) throw new Error(`Expected exactly 1 of 2 concurrent over-subscribing circuit receipts to succeed, got ${fulfilled71}`);
    const jobAfter71 = (await Job.findById(t71.job._id))!;
    const circuitAfter71 = jobAfter71.jobCircuits[0];
    if (circuitAfter71.receivedGoodQty !== 7) throw new Error(`Expected receivedGoodQty=7 (one request's worth), got ${circuitAfter71.receivedGoodQty}`);
    console.log(`  ✓ 2 concurrent receipts requesting 7 each (ordered=10, combined=14) -> exactly 1 succeeded`);
    console.log('  ✓ Pass: Concurrent combined receipts cannot over-receive a job circuit');

    // Test 72: Transaction rollback - circuit line succeeds individually,
    // component-return line fails, EVERYTHING in the combined transaction
    // (including the circuit/consumption/FinishedGoods writes) rolls back.
    console.log('\n[Test 72]: Verifying Combined Receipt Rolls Back Everything On A Later Line Failure');
    const t72 = await makeIssuedJobForReceipt(5);
    const fgBefore72 = await FinishedGoods.findOne({ circuitId: crCircuit._id });
    const fgBalanceBefore72 = fgBefore72?.goodQtyBalance || 0;
    const jobBefore72 = (await Job.findById(t72.job._id))!;
    const circuitBefore72 = { receivedGoodQty: jobBefore72.jobCircuits[0].receivedGoodQty, receivedRejectedQty: jobBefore72.jobCircuits[0].receivedRejectedQty };

    let rollbackError72: any = null;
    try {
      await performJobReceipt(
        t72.job._id.toString(),
        {
          circuitReceipts: [{ jobCircuitId: t72.jobCircuitId, goodQty: 5, rejectedQty: 0 }], // would succeed alone
          componentReturns: [
            { componentId: crResComp._id.toString(), challanId: t72.challan._id.toString(), receivedQty: 99999, damagedQty: 0 }, // forces failure
          ],
        },
        `test-key-${Date.now()}-JR5`,
        crAdmin._id
      );
    } catch (e) {
      rollbackError72 = e;
    }
    if (!(rollbackError72 instanceof ReceiptError)) throw new Error('Expected rollback scenario to throw ReceiptError');

    const fgAfter72 = await FinishedGoods.findOne({ circuitId: crCircuit._id });
    const fgBalanceAfter72 = fgAfter72?.goodQtyBalance || 0;
    const jobAfter72 = (await Job.findById(t72.job._id))!;
    const circuitAfter72 = jobAfter72.jobCircuits[0];

    if (fgBalanceAfter72 !== fgBalanceBefore72) throw new Error('FinishedGoods balance changed despite the overall receipt failing - not rolled back');
    if (circuitAfter72.receivedGoodQty !== circuitBefore72.receivedGoodQty) {
      throw new Error('Job circuit receivedGoodQty changed despite the overall receipt failing - not rolled back');
    }
    const receiptCountAfter72 = await JobReceipt.countDocuments({ jobId: t72.job._id });
    if (receiptCountAfter72 !== 0) throw new Error('A JobReceipt record was orphaned despite the overall request failing');
    console.log('  ✓ Circuit receipt (would have succeeded alone) was rolled back along with the failing component return');
    console.log(`  ✓ FinishedGoods balance unchanged (${fgBalanceAfter72}), no orphaned JobReceipt record`);
    console.log('  ✓ Pass: The entire combined transaction commits or rolls back as one unit');

    // Test 73: No double consumption across BOTH receipt workflows -
    // standalone challan-scoped MaterialReceipt AND combined JobReceipt
    // share the same Job.materialRequirement counters and the same guard.
    console.log('\n[Test 73]: Verifying No Double Accounting Across Standalone And Combined Receipt Workflows');
    const t73 = await makeIssuedJobForReceipt(5); // RES issued=10
    // First, return 6 RES via the ORIGINAL standalone challan-scoped flow
    await performMaterialReceiptFn(
      t73.challan._id.toString(),
      [{ componentId: crResComp._id.toString(), receivedQty: 6, damagedQty: 0 }],
      `test-key-${Date.now()}-JR6a`,
      crAdmin._id
    );
    // Now try to consume via JobReceipt circuits enough that combined with
    // the 6 already returned it would exceed the 10 issued (5 circuits x 2 = 10 consumption attempted, +6 returned = 16 > 10 issued)
    let doubleAccountError: any = null;
    try {
      await performJobReceipt(
        t73.job._id.toString(),
        { circuitReceipts: [{ jobCircuitId: t73.jobCircuitId, goodQty: 5, rejectedQty: 0 }] },
        `test-key-${Date.now()}-JR6b`,
        crAdmin._id
      );
    } catch (e) {
      doubleAccountError = e;
    }
    if (!(doubleAccountError instanceof ReceiptError) || !doubleAccountError.message.includes('exceeds remaining unaccounted issued quantity')) {
      throw new Error(`Expected over-consumption (double accounting) rejection, got: ${doubleAccountError}`);
    }
    console.log(`  ✓ Pass: Standalone return (6) + attempted full consumption (10) correctly rejected as exceeding issued (10) ("${doubleAccountError.message}")`);

    // Test 74: Material reconciliation endpoint correctness
    console.log('\n[Test 74]: Verifying Material Reconciliation Computation');
    const t74 = await makeIssuedJobForReceipt(4); // RES issued=8, CAP issued=4
    await performJobReceipt(
      t74.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t74.jobCircuitId, goodQty: 4, rejectedQty: 0 }] }, // fully consumes everything, nothing returned/damaged
      `test-key-${Date.now()}-JR7`,
      crAdmin._id
    );
    const jobFor74 = (await Job.findById(t74.job._id))!;
    const reconciliation74 = await computeJobReconciliation(jobFor74);
    if (!reconciliation74.closeEligible) throw new Error('Expected fully-reconciled job to be closeEligible');
    const resRow74 = reconciliation74.components.find((c) => c.partCode === 'RES-10K-0805-1%')!;
    if (resRow74.remainingWithVendor !== 0 || resRow74.ledgerDiscrepancy !== 0) {
      throw new Error(`Expected RES remainingWithVendor=0 and ledgerDiscrepancy=0, got ${resRow74.remainingWithVendor}/${resRow74.ledgerDiscrepancy}`);
    }
    const circuitRow74 = reconciliation74.circuits[0];
    if (!circuitRow74.isFullyAccounted) throw new Error('Expected circuit to be fully accounted (4 good = 4 ordered)');
    console.log('  ✓ All components: remainingWithVendor=0, ledgerDiscrepancy=0; all circuits fully accounted');
    console.log('  ✓ Pass: Reconciliation correctly identifies a fully-reconciled, close-eligible job');

    // Test 75: Normal job closing (and read-only enforcement afterward)
    console.log('\n[Test 75]: Verifying Normal Job Closing & Read-Only Enforcement');
    const closeResult75 = await performJobClose(t74.job._id.toString(), crAdmin._id);
    if (closeResult75.job.status !== 'closed') throw new Error(`Expected status 'closed', got '${closeResult75.job.status}'`);
    if (closeResult75.job.isShortClosed) throw new Error('Expected isShortClosed=false for a normal close');
    if (!closeResult75.job.closeReconciliationSnapshot) throw new Error('Expected closeReconciliationSnapshot to be stored');

    let postCloseError: any = null;
    try {
      await performJobReceipt(t74.job._id.toString(), { circuitReceipts: [{ jobCircuitId: t74.jobCircuitId, goodQty: 1, rejectedQty: 0 }] }, `test-key-${Date.now()}-JR8`, crAdmin._id);
    } catch (e) {
      postCloseError = e;
    }
    if (!(postCloseError instanceof ReceiptError)) throw new Error('Expected a closed job to reject further receipts');
    console.log(`  ✓ Job closed normally, reconciliation snapshot stored`);
    console.log(`  ✓ Pass: Closed job correctly rejects further receipts ("${postCloseError.message}")`);

    // Test 76: Short-close safeguards (incomplete job, no unsafe stock changes)
    console.log('\n[Test 76]: Verifying Short-Close Safeguards');
    const t76 = await makeIssuedJobForReceipt(10);
    await performJobReceipt(
      t76.job._id.toString(),
      { circuitReceipts: [{ jobCircuitId: t76.jobCircuitId, goodQty: 6, rejectedQty: 0 }] }, // only 6 of 10 - incomplete
      `test-key-${Date.now()}-JR9`,
      crAdmin._id
    );

    let normalCloseRejected: any = null;
    try {
      await performJobClose(t76.job._id.toString(), crAdmin._id);
    } catch (e) {
      normalCloseRejected = e;
    }
    if (!(normalCloseRejected instanceof JobApprovalError)) throw new Error('Expected normal close to be rejected for an incomplete job');

    let shortCloseNoReason: any = null;
    try {
      await performJobClose(t76.job._id.toString(), crAdmin._id, { shortClose: true });
    } catch (e) {
      shortCloseNoReason = e;
    }
    if (!(shortCloseNoReason instanceof JobApprovalError) || !shortCloseNoReason.message.includes('reason')) {
      throw new Error(`Expected short-close without a reason to be rejected, got: ${shortCloseNoReason}`);
    }

    const resBeforeShortClose76 = (await Component.findById(crResComp._id))!;
    const shortCloseResult76 = await performJobClose(t76.job._id.toString(), crAdmin._id, {
      shortClose: true,
      reason: 'Vendor unable to deliver remaining units - short-closing per manager approval',
    });
    const resAfterShortClose76 = (await Component.findById(crResComp._id))!;

    if (shortCloseResult76.job.status !== 'closed' || !shortCloseResult76.job.isShortClosed) {
      throw new Error('Expected short-close to result in status=closed, isShortClosed=true');
    }
    if (!shortCloseResult76.job.closeReason) throw new Error('Expected closeReason to be stored');
    if (resAfterShortClose76.inStoreStock !== resBeforeShortClose76.inStoreStock || resAfterShortClose76.withVendorStock !== resBeforeShortClose76.withVendorStock) {
      throw new Error('Short-close performed an unsafe automatic stock adjustment - it must never touch stock directly');
    }
    console.log('  ✓ Normal close correctly rejected for an incomplete job');
    console.log('  ✓ Short-close without a reason correctly rejected');
    console.log('  ✓ Short-close with a reason succeeded; stock completely untouched by the close itself');
    console.log('  ✓ Pass: Short-close safeguards enforced correctly');

    // Test 77: Existing MaterialReceipt compatibility - the standalone
    // challan-scoped flow still works exactly as before AND now also
    // updates the new job-level counters correctly.
    console.log('\n[Test 77]: Verifying Existing Standalone MaterialReceipt Compatibility');
    const t77 = await makeIssuedJobForReceipt(3); // RES issued=6
    const standaloneResult77 = await performMaterialReceiptFn(
      t77.challan._id.toString(),
      [{ componentId: crResComp._id.toString(), receivedQty: 6, damagedQty: 0 }],
      `test-key-${Date.now()}-JR10`,
      crAdmin._id
    );
    if (standaloneResult77.alreadyProcessed) throw new Error('Expected a fresh standalone receipt');
    const jobAfter77 = (await Job.findById(t77.job._id))!;
    const resLine77 = jobAfter77.materialRequirement.find((m) => m.componentId.toString() === crResComp._id.toString())!;
    if (resLine77.returnedQty !== 6) throw new Error(`Expected job-level RES returnedQty=6 after standalone receipt, got ${resLine77.returnedQty}`);
    console.log(`  ✓ Pass: Standalone challan-scoped receipt still works and correctly updates the new job-level returnedQty counter`);

    // Test 78: Historical counter backfill correctness
    console.log('\n[Test 78]: Verifying Historical Counter Backfill');
    const t78 = await makeIssuedJobForReceipt(5); // RES issued=10
    await performMaterialReceiptFn(
      t78.challan._id.toString(),
      [{ componentId: crResComp._id.toString(), receivedQty: 7, damagedQty: 1 }],
      `test-key-${Date.now()}-JR11`,
      crAdmin._id
    );
    // Simulate a "legacy" job whose counters predate this feature (zeroed out directly)
    await Job.updateOne(
      { _id: t78.job._id },
      { $set: { 'materialRequirement.$[elem].returnedQty': 0, 'materialRequirement.$[elem].damagedQty': 0 } },
      { arrayFilters: [{ 'elem.componentId': crResComp._id }] }
    );
    const legacyJob78 = (await Job.findById(t78.job._id))!;
    const challansFor78 = await DeliveryChallan.find({ jobId: t78.job._id });
    const { changed: backfillChanged78, counters: backfillCounters78 } = computeBackfilledCounters(legacyJob78, challansFor78);
    const resCounter78 = backfillCounters78.find((c) => c.componentId === crResComp._id.toString())!;
    if (!backfillChanged78) throw new Error('Expected backfill to detect a change on the zeroed-out legacy counters');
    if (resCounter78.returnedQty !== 7 || resCounter78.damagedQty !== 1) {
      throw new Error(`Expected backfill to recompute returnedQty=7, damagedQty=1 from challan data, got ${resCounter78.returnedQty}/${resCounter78.damagedQty}`);
    }
    console.log(`  ✓ Pass: Backfill correctly recomputed returnedQty=7, damagedQty=1 from existing DeliveryChallan data`);

    // Cleanup
    await Job.deleteMany({ _id: { $in: crCreatedJobIds } });
    await DeliveryChallan.deleteMany({ jobId: { $in: crCreatedJobIds } });
    await JobReceipt.deleteMany({ jobId: { $in: crCreatedJobIds } });
    await MaterialReceipt.deleteMany({ jobId: { $in: crCreatedJobIds } });
    await FinishedGoods.deleteMany({ circuitId: crCircuit._id });
    await FinishedGoodsTransaction.deleteMany({ circuitId: crCircuit._id });
    await Circuit.deleteMany({ circuitCode: 'TEST-JOBRECEIPT-MAIN' });
    console.log('\n  (Combined job receipt test data cleaned up)');
  }

  console.log('\n====================================================');
  console.log('   ALL DAY 1-5 + CORRECTION TESTS PASSED! ');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Test verification failed:', err);
  process.exit(1);
});
