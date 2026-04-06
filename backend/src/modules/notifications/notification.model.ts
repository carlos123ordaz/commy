import mongoose, { Schema, Document, Model } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../config/constants';

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  table: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  type: NotificationType;
  message?: string;
  alias?: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: Schema.Types.ObjectId, ref: 'Table', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String },
    alias: { type: String },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ restaurant: 1, isResolved: 1, createdAt: -1 });

export const NotificationModel: Model<INotification> = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);
