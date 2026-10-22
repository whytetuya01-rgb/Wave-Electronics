import mongoose, { Schema, Document } from 'mongoose';

// One document per rate-limited client and limiter, e.g. 'login:203.0.113.7',
// shared by every server instance. The TTL index lets MongoDB delete a
// document after its window has ended (its TTL monitor runs about once a
// minute); an expired document still left behind is treated as a new window.
export interface IRateLimitCounter extends Omit<Document, '_id'> {
  _id: string;
  hits: number;
  resetAt: Date;
}

const RateLimitCounterSchema = new Schema<IRateLimitCounter>(
  {
    _id: { type: String, required: true },
    hits: { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false }
);

RateLimitCounterSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitCounter = mongoose.model<IRateLimitCounter>('RateLimitCounter', RateLimitCounterSchema);
