import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { IJob } from './models/Job.js';
import { IDeliveryChallan } from './models/DeliveryChallan.js';

// One-time backfill: populates the new Job.materialRequirement[].returnedQty
// and .damagedQty counters (introduced for job-level reconciliation) from
// EXISTING DeliveryChallan records, so historical component-return data
// recorded through the original challan-scoped MaterialReceipt flow is
// correctly reflected before the new job-level counters are treated as
// authoritative. consumedQty is left at 0 for all existing jobs, since no
// JobReceipt (finished-circuit receipt) history exists prior to this
// feature - there is nothing to backfill there.
//
// Idempotent: safe to run more than once (it recomputes from source data
// each time rather than incrementing). Exported so it can also be exercised
// directly in tests without shelling out to this script.
export function computeBackfilledCounters(
  job: Pick<IJob, 'materialRequirement'>,
  challans: Pick<IDeliveryChallan, 'items'>[]
): { changed: boolean; counters: Array<{ componentId: string; returnedQty: number; damagedQty: number }> } {
  let changed = false;
  const counters = job.materialRequirement.map((line) => {
    let totalReturned = 0;
    let totalDamaged = 0;
    for (const challan of challans) {
      const challanLine = challan.items.find((i) => i.componentId.toString() === line.componentId.toString());
      if (challanLine) {
        totalReturned += challanLine.receivedQty || 0;
        totalDamaged += challanLine.damagedQty || 0;
      }
    }
    if (line.returnedQty !== totalReturned || line.damagedQty !== totalDamaged) changed = true;
    return { componentId: line.componentId.toString(), returnedQty: totalReturned, damagedQty: totalDamaged };
  });
  return { changed, counters };
}

async function migrateJobCounters() {
  console.log('====================================================');
  console.log('   MIGRATION: Backfill Job.materialRequirement counters');
  console.log('====================================================\n');

  await connectDB();

  const { Job } = await import('./models/Job.js');
  const { DeliveryChallan } = await import('./models/DeliveryChallan.js');

  const jobs = await Job.find({ 'materialRequirement.0': { $exists: true } });
  console.log(`Found ${jobs.length} job(s) with material requirements to check.\n`);

  let updatedJobs = 0;
  let updatedLines = 0;

  for (const job of jobs) {
    const challans = await DeliveryChallan.find({ jobId: job._id });
    if (challans.length === 0) continue;

    const { changed, counters } = computeBackfilledCounters(job, challans);
    if (!changed) continue;

    for (const c of counters) {
      const line = job.materialRequirement.find((l) => l.componentId.toString() === c.componentId)!;
      if (line.returnedQty !== c.returnedQty || line.damagedQty !== c.damagedQty) {
        console.log(
          `  Job ${job.jobNumber} / ${line.partCode}: returnedQty ${line.returnedQty} -> ${c.returnedQty}, damagedQty ${line.damagedQty} -> ${c.damagedQty}`
        );
        line.returnedQty = c.returnedQty;
        line.damagedQty = c.damagedQty;
        updatedLines++;
      }
    }

    await job.save();
    updatedJobs++;
  }

  console.log(`\n✓ Migration complete: ${updatedJobs} job(s) updated, ${updatedLines} line(s) backfilled.`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

// Only run as a script when executed directly, not when imported for tests.
if (process.argv[1] && process.argv[1].includes('migrate-job-counters')) {
  migrateJobCounters().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
