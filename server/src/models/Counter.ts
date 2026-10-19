import mongoose, { Schema, Document } from 'mongoose';

// Generic atomic sequence counter. _id is the sequence key, e.g. 'stockInward-202610'.
// Reused for Job No, Challan No, Receipt No, etc. — one counter per key.
export interface ICounter extends Omit<Document, '_id'> {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
