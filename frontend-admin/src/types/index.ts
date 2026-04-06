export type Role = 'superadmin' | 'owner' | 'cashier' | 'kitchen' | 'waiter';
export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrderStatus =
  | 'draft'
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'billed'
  | 'closed'
  | 'cancelled';
export type TableStatus = 'free' | 'occupied' | 'with_order' | 'pending_payment' | 'cleaning';
export type NotificationType = 'call_waiter' | 'request_bill' | 'assistance';

export interface User {
  _id: string;
  username: string;
  email: string;
  role: Role;
  restaurantId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

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
  legalName?: string;
  slug: string;
  email: string;
  phone?: string;
  logo?: string;
  plan: Plan;
  isActive: boolean;
  settings: {
    currency: string;
    timezone: string;
    acceptingOrders: boolean;
    primaryColor: string;
    delivery: DeliveryConfig;
    takeaway: ChannelConfig;
  };
  createdAt: string;
}

export type TableShape = 'rect' | 'rounded' | 'circle';
export type DecorationItemType = 'bar' | 'wall' | 'entrance' | 'label' | 'plant';

export interface TableLayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: TableShape;
}

export interface Table {
  _id: string;
  name: string;
  number?: number;
  capacity: number;
  zone?: string;
  status: TableStatus;
  qrCode: string;
  qrUrl: string;
  isActive: boolean;
  restaurant: string;
  layout?: TableLayoutPosition;
}

export interface FloorZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex: number;
}

export interface FloorDecoration {
  id: string;
  type: DecorationItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
  zIndex: number;
}

export interface ZoneLayout {
  zoneName: string;        // matches Table.zone (or 'general' for unassigned)
  canvasWidth: number;
  canvasHeight: number;
  decorations: FloorDecoration[];
}

export interface RestaurantFloorLayout {
  background: string;
  zoneLayouts: ZoneLayout[];
  // legacy (kept for TS compat, ignored by new code)
  canvasWidth?: number;
  canvasHeight?: number;
  zones?: FloorZone[];
  decorations?: FloorDecoration[];
}

export interface FloorPlanResponse {
  tables: Table[];
  layout: RestaurantFloorLayout;
}

export interface TableRealTimeData {
  tableId: string;
  status?: TableStatus;
  activeOrder?: {
    orderId: string;
    orderNumber: number;
    status: OrderStatus;
    total: number;
    itemCount: number;
    createdAt: string;
  };
  hasAlert: boolean;
  alertType?: NotificationType;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  order: number;
  isActive: boolean;
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
  isActive: boolean;
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
  allowedProducts: string[] | MenuGroupProduct[];
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
  order: number;
  productType: ProductType;
  selectionGroups: SelectionGroup[];
  menuGroups: MenuGroup[];
  accompanimentCategories: string[];
  isCompanion: boolean;
}

export interface OrderModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdd: number;
}

export interface OrderSelectedOption {
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface OrderSelectedGroup {
  groupId: string;
  groupName: string;
  selectedOptions: OrderSelectedOption[];
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

export interface OrderAccompaniment {
  categoryId: string;
  categoryName: string;
  productId: string;
  productName: string;
}

export interface OrderItem {
  _id: string;
  product: string | Product;
  productSnapshot: { name: string; price: number; imageUrl?: string; productType?: string };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: OrderModifier[];
  selectedGroups: OrderSelectedGroup[];
  selectedMenuGroups: OrderMenuGroup[];
  selectedAccompaniments: OrderAccompaniment[];
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

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'manual';

export interface CustomerInfo {
  name: string;
  phone?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Order {
  _id: string;
  restaurant: string | Restaurant;
  table?: Table | string;
  orderNumber: number;
  status: OrderStatus;
  orderType: OrderType;
  participants: OrderParticipant[];
  items: OrderItem[];
  subtotal: number;
  surcharge: number;
  total: number;
  customerInfo?: CustomerInfo;
  notes?: string;
  confirmedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  restaurant: string;
  table: Table;
  order?: string;
  type: NotificationType;
  message?: string;
  alias?: string;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  activeOrders: number;
  avgTicket: number;
}
