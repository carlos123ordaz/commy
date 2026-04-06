import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IModifierOption {
  _id: mongoose.Types.ObjectId;
  name: string;
  priceAdd: number;
  isAvailable: boolean;
}

export interface IModifierGroup extends Document {
  _id: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  name: string;
  required: boolean;
  multipleSelection: boolean;
  minSelections: number;
  maxSelections: number;
  options: IModifierOption[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const modifierOptionSchema = new Schema<IModifierOption>({
  name: { type: String, required: true, trim: true },
  priceAdd: { type: Number, default: 0, min: 0 },
  isAvailable: { type: Boolean, default: true },
});

const modifierGroupSchema = new Schema<IModifierGroup>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    multipleSelection: { type: Boolean, default: false },
    minSelections: { type: Number, default: 0 },
    maxSelections: { type: Number, default: 1 },
    options: [modifierOptionSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

modifierGroupSchema.index({ restaurant: 1, isActive: 1 });

export const ModifierGroupModel: Model<IModifierGroup> = mongoose.model<IModifierGroup>(
  'ModifierGroup',
  modifierGroupSchema
);
