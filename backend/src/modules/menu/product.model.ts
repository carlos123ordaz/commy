import mongoose, { Schema, Document, Model } from 'mongoose';

export type ProductType = 'simple' | 'configurable' | 'combo' | 'menu';

export interface ISelectionOption {
  _id: mongoose.Types.ObjectId;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ISelectionGroup {
  _id: mongoose.Types.ObjectId;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ISelectionOption[];
}

/**
 * A group inside a "menu" type product.
 * Each group references real Product IDs as allowed options.
 * Availability is checked against the referenced products at order time.
 */
export interface IMenuGroup {
  _id: mongoose.Types.ObjectId;
  /** Stable key used to match groups in snapshots (e.g. "entrada", "segundo") */
  key: string;
  name: string;
  required: boolean;
  /** Always 1 for now; kept as field for future support */
  maxSelections: number;
  /** Show explicit "Sin X" option when group is optional */
  allowNoneOption: boolean;
  /** Price reduction applied when this optional group is omitted */
  omitDiscount: number;
  /** Product IDs that are valid choices for this group */
  allowedProducts: mongoose.Types.ObjectId[];
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  /** For menu type: this is the basePrice (full price when all groups chosen) */
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  estimatedTime?: number;
  modifierGroups: mongoose.Types.ObjectId[];
  tags: string[];
  order: number;
  productType: ProductType;
  selectionGroups: ISelectionGroup[];
  /** Only populated when productType === 'menu' */
  menuGroups: IMenuGroup[];
  /** Categories the customer must pick a product from when ordering this item */
  accompanimentCategories: mongoose.Types.ObjectId[];
  /** If true, this product is a companion/side dish and won't appear in the main menu listing */
  isCompanion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const selectionOptionSchema = new Schema<ISelectionOption>(
  {
    name: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: true }
);

const selectionGroupSchema = new Schema<ISelectionGroup>(
  {
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    minSelections: { type: Number, default: 1 },
    maxSelections: { type: Number, default: 1 },
    options: [selectionOptionSchema],
  },
  { _id: true }
);

const menuGroupSchema = new Schema<IMenuGroup>(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: true },
    maxSelections: { type: Number, default: 1 },
    allowNoneOption: { type: Boolean, default: false },
    omitDiscount: { type: Number, default: 0, min: 0 },
    allowedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { _id: true }
);

const productSchema = new Schema<IProduct>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    estimatedTime: { type: Number },
    modifierGroups: [{ type: Schema.Types.ObjectId, ref: 'ModifierGroup' }],
    tags: [{ type: String }],
    order: { type: Number, default: 0 },
    productType: { type: String, enum: ['simple', 'configurable', 'combo', 'menu'], default: 'simple' },
    selectionGroups: [selectionGroupSchema],
    menuGroups: [menuGroupSchema],
    accompanimentCategories: [{ type: Schema.Types.ObjectId, ref: 'Category', default: [] }],
    isCompanion: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ restaurant: 1, category: 1, isAvailable: 1 });
productSchema.index({ restaurant: 1, isAvailable: 1, order: 1 });

export const ProductModel: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
