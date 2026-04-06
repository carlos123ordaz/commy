export const ORDER_STATUSES = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'billed',
  'closed',
  'cancelled',
] as const;

export const EDITABLE_ORDER_STATUSES = ['draft', 'pending_confirmation'] as const;

export const ROLES = ['superadmin', 'owner', 'cashier', 'kitchen', 'waiter'] as const;

export const TABLE_STATUSES = [
  'free',
  'occupied',
  'with_order',
  'pending_payment',
  'cleaning',
] as const;

export const NOTIFICATION_TYPES = ['call_waiter', 'request_bill', 'assistance'] as const;

export const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;

export const SALT_ROUNDS = 12;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
