import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPushSubscription extends Document {
  user: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// Un usuario puede tener múltiples dispositivos/navegadores, pero no duplicados del mismo endpoint
pushSubscriptionSchema.index({ user: 1, endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ restaurant: 1 });

export const PushSubscriptionModel: Model<IPushSubscription> = mongoose.model<IPushSubscription>(
  'PushSubscription',
  pushSubscriptionSchema
);
