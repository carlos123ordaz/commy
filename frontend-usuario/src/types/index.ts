export interface DeliveryHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface ChannelConfig {
  enabled: boolean;
  qrToken?: string;
  qrUrl?: string;
  fee: number;
}

export interface DeliveryConfig extends ChannelConfig {
  hours: DeliveryHour[];
  estimatedMinutes: number;
}

export interface Restaurant {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  settings: {
    currency: string;
    primaryColor: string;
    acceptingOrders: boolean;
    delivery: DeliveryConfig;
    takeaway: ChannelConfig;
  };
}

export interface CustomerInfo {
  name: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

export interface TableInfo {
  _id: string;
  name: string;
  number?: number;
  zone?: string;
  status: string;
  qrCode: string;
  restaurant: Restaurant;
}

export interface ModifierOption {
  _id: string;
  name: string;
  priceAdd: number;
  isAvailable: boolean;
}

export interface ModifierGroup {
  _id: string;
  name: string;
  required: boolean;
  multipleSelection: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  order: number;
}

export type ProductType = 'simple' | 'configurable' | 'combo' | 'menu';

export interface SelectionOption {
  _id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface SelectionGroup {
  _id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: SelectionOption[];
}

export interface SelectedGroupOption {
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface SelectedGroup {
  groupId: string;
  groupName: string;
  selectedOptions: SelectedGroupOption[];
}

export interface MenuGroupProduct {
  _id: string;
  name: string;
  isAvailable: boolean;
  imageUrl?: string;
}

export interface MenuGroup {
  _id: string;
  key: string;
  name: string;
  required: boolean;
  maxSelections: number;
  allowNoneOption: boolean;
  omitDiscount: number;
  allowedProducts: MenuGroupProduct[];
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  estimatedTime?: number;
  category: Category | string;
  modifierGroups: ModifierGroup[];
  productType: ProductType;
  selectionGroups: SelectionGroup[];
  menuGroups: MenuGroup[];
  accompanimentCategories: string[];
  isCompanion: boolean;
  /** Populated only when fetching product detail — contains available products for each accompaniment category */
  accompanimentProducts?: Product[];
}

export interface SelectedAccompaniment {
  categoryId: string;
  categoryName: string;
  productId: string;
  productName: string;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdd: number;
}

export interface OrderMenuGroup {
  groupId: string;
  groupKey: string;
  groupName: string;
  omitted: boolean;
  selectedProductId?: string;
  selectedProductName?: string;
  omitDiscount: number;
}

export interface OrderItem {
  _id: string;
  product: string | Product;
  productSnapshot: { name: string; price: number; imageUrl?: string; productType?: string };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: SelectedModifier[];
  selectedGroups: SelectedGroup[];
  selectedMenuGroups: OrderMenuGroup[];
  selectedAccompaniments: SelectedAccompaniment[];
  notes?: string;
  addedBySessionId: string;
  addedByAlias?: string;
  status: string;
}

export interface OrderParticipant {
  sessionId: string;
  alias?: string;
  joinedAt: string;
}

export type OrderStatus = 'draft' | 'pending_confirmation' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'billed' | 'closed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'manual';

export interface Order {
  _id: string;
  restaurant: string | Restaurant;
  table?: string | TableInfo;
  orderNumber: number;
  status: OrderStatus;
  orderType: OrderType;
  participants: OrderParticipant[];
  readyParticipants: string[];
  items: OrderItem[];
  subtotal: number;
  surcharge: number;
  total: number;
  customerInfo?: CustomerInfo;
  createdAt: string;
  updatedAt: string;
}

export interface SessionState {
  sessionId: string;
  alias?: string;
  tableToken?: string;
  tableId?: string;
  restaurantId?: string;
  orderId?: string;
}

export interface GoogleCustomer {
  id: string;
  name: string;
  email: string;
  picture?: string;
  token: string;
  phone?: string;
  address?: string;
}
