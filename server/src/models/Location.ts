import mongoose, { Schema, Document } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  zone?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    zone: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
