import mongoose, { Schema, Document, Model } from 'mongoose';
import { ORDER_STATUSES } from '../../config/constants';

type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderModifier {
  groupId: mongoose.Types.ObjectId;
  groupName: string;
  optionId: mongoose.Types.ObjectId;
  optionName: string;
  priceAdd: number;
}

export interface IOrderSelectedOption {
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface IOrderSelectedGroup {
  groupId: string;
  groupName: string;
  selectedOptions: IOrderSelectedOption[];
}

/**
 * Snapshot of one group selection inside a "menu" type order item.
 * Stored as a full snapshot so kitchen/history never needs to join.
 */
export interface IOrderMenuGroup {
  groupId: string;
  groupKey: string;
  groupName: string;
  /** True when the customer chose "Sin X" (only valid for optional groups) */
  omitted: boolean;
  selectedProductId?: string;
  selectedProductName?: string;
  /** Discount applied to the base price because this group was omitted */
  omitDiscount: number;
}

export interface IOrderAccompaniment {
  categoryId: string;
  categoryName: string;
  productId: string;
  productName: string;
}

export interface IOrderItem {
  _id: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  productSnapshot: {
    name: string;
    price: number;
    imageUrl?: string;
    /** Stored so renders don't need to re-fetch the product */
    productType?: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: IOrderModifier[];
  selectedGroups: IOrderSelectedGroup[];
  /** Only present when productSnapshot.productType === 'menu' */
  selectedMenuGroups: IOrderMenuGroup[];
  /** Products chosen from each accompaniment category */
  selectedAccompaniments: IOrderAccompaniment[];
  notes?: string;
  addedBySessionId: string;
  addedByAlias?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
}

export interface IOrderParticipant {
  sessionId: string;
  alias?: string;
  joinedAt: Date;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'manual';

export interface ICustomerInfo {
  name: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  table?: mongoose.Types.ObjectId; // optional — null for delivery/takeaway orders
  orderNumber: number;
  status: OrderStatus;
  orderType: OrderType;
  participants: IOrderParticipant[];
  readyParticipants: string[];
  items: IOrderItem[];
  subtotal: number;
  surcharge: number; // delivery/takeaway extra fee
  total: number;
  customerInfo?: ICustomerInfo; // for delivery/takeaway orders
  notes?: string;
  confirmedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderModifierSchema = new Schema<IOrderModifier>(
  {
    groupId: { type: Schema.Types.ObjectId },
    groupName: { type: String },
    optionId: { type: Schema.Types.ObjectId },
    optionName: { type: String },
    priceAdd: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderSelectedOptionSchema = new Schema<IOrderSelectedOption>(
  {
    optionId: { type: String, required: true },
    optionName: { type: String, required: true },
    priceDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderSelectedGroupSchema = new Schema<IOrderSelectedGroup>(
  {
    groupId: { type: String, required: true },
    groupName: { type: String, required: true },
    selectedOptions: [orderSelectedOptionSchema],
  },
  { _id: false }
);

const orderMenuGroupSchema = new Schema<IOrderMenuGroup>(
  {
    groupId: { type: String, required: true },
    groupKey: { type: String, required: true },
    groupName: { type: String, required: true },
    omitted: { type: Boolean, default: false },
    selectedProductId: { type: String },
    selectedProductName: { type: String },
    omitDiscount: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderAccompanimentSchema = new Schema<IOrderAccompaniment>(
  {
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productSnapshot: {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String },
    productType: { type: String },
  },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  modifiers: [orderModifierSchema],
  selectedGroups: [orderSelectedGroupSchema],
  selectedMenuGroups: [orderMenuGroupSchema],
  selectedAccompaniments: [orderAccompanimentSchema],
  notes: { type: String, trim: true },
  addedBySessionId: { type: String, required: true },
  addedByAlias: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'pending',
  },
});

const participantSchema = new Schema<IOrderParticipant>(
  {
    sessionId: { type: String, required: true },
    alias: { type: String },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerInfoSchema = new Schema<ICustomerInfo>(
  {
    name: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    coordinates: {
      type: new Schema({ lat: { type: Number }, lng: { type: Number } }, { _id: false }),
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: Schema.Types.ObjectId, ref: 'Table' }, // optional for delivery/takeaway
    orderNumber: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'draft' },
    orderType: { type: String, enum: ['dine_in', 'takeaway', 'delivery', 'manual'], default: 'dine_in' },
    participants: [participantSchema],
    readyParticipants: [{ type: String }],
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0 },
    surcharge: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    customerInfo: { type: customerInfoSchema },
    notes: { type: String },
    confirmedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ restaurant: 1, table: 1, status: 1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, orderNumber: 1 }, { unique: true });

export const OrderModel: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);
