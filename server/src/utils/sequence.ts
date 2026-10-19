import { ClientSession } from 'mongoose';
import { Counter } from '../models/Counter.js';

interface GetNextSequenceOptions {
  session?: ClientSession | null;
  // Called only on first-ever use of `key`, to seed the counter so new numbers
  // cannot collide with documents that already exist (e.g. from seed data or
  // records created before the counter existed). Must return the highest
  // sequence number already in use for this key (0 if none).
  initFrom?: () => Promise<number>;
}

// Atomically returns the next integer in the sequence identified by `key`.
// Safe under concurrent callers: the increment itself is a single atomic
// findOneAndUpdate, and first-time initialization is guarded against the
// concurrent-upsert race documented by MongoDB (duplicate key on insert is
// caught and retried as a plain increment).
export async function getNextSequence(key: string, options: GetNextSequenceOptions = {}): Promise<number> {
  const { session = null, initFrom } = options;

  let counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, session: session || undefined }
  );

  if (counter) {
    return counter.seq;
  }

  // Counter doesn't exist yet - initialize it, accounting for any existing
  // documents that were created before this counter existed.
  const startFrom = initFrom ? await initFrom() : 0;

  try {
    const created = await Counter.create([{ _id: key, seq: startFrom + 1 }], {
      session: session || undefined,
    });
    counter = created[0];
  } catch (error: any) {
    if (error.code === 11000) {
      // Lost the initialization race to a concurrent caller - counter now
      // exists, so just increment it normally.
      counter = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { new: true, session: session || undefined }
      );
    } else {
      throw error;
    }
  }

  if (!counter) {
    throw new Error(`Failed to generate sequence for key '${key}'`);
  }

  return counter.seq;
}
