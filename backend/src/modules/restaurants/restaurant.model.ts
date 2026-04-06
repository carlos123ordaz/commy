import mongoose, { Schema, Document, Model } from 'mongoose';
import { PLANS } from '../../config/constants';

type Plan = (typeof PLANS)[number];

export interface IDeliveryHour {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  openTime: string;  // "HH:MM" 24 h
  closeTime: string; // "HH:MM" 24 h
}

export interface IChannelConfig {
  enabled: boolean;
  qrToken?: string;
  qrUrl?: string;
  fee: number; // extra flat charge added to order total
}

export interface IDeliveryConfig extends IChannelConfig {
  hours: IDeliveryHour[];
  estimatedMinutes: number;
}

export interface IRestaurantSettings {
  currency: string;
  timezone: string;
  acceptingOrders: boolean;
  primaryColor: string;
  delivery: IDeliveryConfig;
  takeaway: IChannelConfig;
}

export interface IRestaurant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  legalName?: string;
  slug: string;
  email: string;
  phone?: string;
  logo?: string;
  plan: Plan;
  isActive: boolean;
  settings: IRestaurantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryHourSchema = new Schema<IDeliveryHour>(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
  },
  { _id: false }
);

const restaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    logo: { type: String },
    plan: { type: String, enum: PLANS, default: 'starter' },
    isActive: { type: Boolean, default: true, index: false },
    settings: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'America/Lima' },
      acceptingOrders: { type: Boolean, default: true },
      primaryColor: { type: String, default: '#6366F1' },
      delivery: {
        enabled: { type: Boolean, default: false },
        qrToken: { type: String },
        qrUrl: { type: String },
        fee: { type: Number, default: 0 },
        hours: { type: [deliveryHourSchema], default: [] },
        estimatedMinutes: { type: Number, default: 30 },
      },
      takeaway: {
        enabled: { type: Boolean, default: false },
        qrToken: { type: String },
        qrUrl: { type: String },
        fee: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
);

restaurantSchema.index({ slug: 1 }, { unique: true });
restaurantSchema.index({ isActive: 1 });

export const RestaurantModel: Model<IRestaurant> = mongoose.model<IRestaurant>(
  'Restaurant',
  restaurantSchema
);
