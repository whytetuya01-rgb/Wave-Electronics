import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { RateLimitCounter } from '../models/RateLimitCounter.js';

// express-rate-limit store kept in MongoDB, so every server instance - each
// Vercel function instance included - counts against the same per-client
// total. Fixed window: a client's first hit opens a window of `windowMs`,
// hits inside it add up, and the first hit after it ends opens a new one.
export class MongoRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private id(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const doc = await RateLimitCounter.findById(this.id(key)).lean();
    if (!doc || doc.resetAt <= new Date()) return undefined;
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const windowOpen = { $gt: ['$resetAt', now] };
    // One atomic pipeline update: add to the open window, or start a new one
    // (a missing document, or one whose window has ended).
    const update = [
      {
        $set: {
          hits: { $cond: [windowOpen, { $add: ['$hits', 1] }, 1] },
          resetAt: { $cond: [windowOpen, '$resetAt', new Date(now.getTime() + this.windowMs)] },
        },
      },
    ];

    let doc;
    try {
      doc = await RateLimitCounter.findOneAndUpdate({ _id: this.id(key) }, update, { upsert: true, new: true }).lean();
    } catch (err: any) {
      // Two first hits from one client raced to insert; the loser's hit is
      // applied to the document the winner created.
      if (err?.code !== 11000) throw err;
      doc = await RateLimitCounter.findOneAndUpdate({ _id: this.id(key) }, update, { new: true }).lean();
    }
    if (!doc) throw new Error('Rate limit counter update returned no document');
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key: string): Promise<void> {
    await RateLimitCounter.updateOne(
      { _id: this.id(key), resetAt: { $gt: new Date() }, hits: { $gt: 0 } },
      { $inc: { hits: -1 } }
    );
  }

  async resetKey(key: string): Promise<void> {
    await RateLimitCounter.deleteOne({ _id: this.id(key) });
  }
}
