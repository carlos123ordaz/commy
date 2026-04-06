import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomer extends Document {
  _id: mongoose.Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  restaurants: mongoose.Types.ObjectId[];
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    picture: { type: String },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    restaurants: [{ type: Schema.Types.ObjectId, ref: 'Restaurant' }],
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

customerSchema.index({ restaurants: 1 });

export const CustomerModel: Model<ICustomer> = mongoose.model<ICustomer>('Customer', customerSchema);
