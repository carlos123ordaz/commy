import mongoose, { Schema, Document, Model } from 'mongoose';
import { ROLES } from '../../config/constants';
import { Role } from '../../common/types';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  restaurant?: mongoose.Types.ObjectId;
  refreshTokenHash?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1, restaurant: 1 }, { unique: true });
userSchema.index({ restaurant: 1, role: 1 });

export const UserModel: Model<IUser> = mongoose.model<IUser>('User', userSchema);
