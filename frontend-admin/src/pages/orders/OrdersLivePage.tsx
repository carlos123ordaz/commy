import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Store,
  Truck,
  User,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Order, OrderItem, OrderStatus, OrderType } from '../../types';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../config/api';
import { useSocketStore } from '../../store/socketStore';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/format';
import { CreateManualOrderModal } from './CreateManualOrderModal';

type ViewMode = 'kanban' | 'list';

type Action =
  | { type: 'SET'; orders: Order[] }
  | { type: 'ADD'; order: Order }
  | { type: 'UPSERT'; order: Order }
  | { type: 'STATUS'; orderId: string; status: OrderStatus }
  | { type: 'ITEM_ADDED'; orderId: string; item: OrderItem };

type NextAction = {
  label: string;
  newStatus: OrderStatus;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
};

type ColumnMeta = {
  status: OrderStatus;
  label: string;
  badge: string;
  softBg: string;
  line: string;
  dot: string;
  emptyTitle: string;
  emptyDescription: string;
};

type TypeMeta = {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
};

const LIVE_STATUSES: OrderStatus[] = ['pending_confirmation', 'confirmed', 'preparing', 'ready', 'served'];
const TERMINAL_STATUSES: OrderStatus[] = ['billed', 'closed', 'cancelled'];

const COLUMNS: ColumnMeta[] = [
  {
    status: 'pending_confirmation',
    label: 'Pendientes',
    badge: 'bg-amber-100 text-amber-800',
    softBg: 'bg-white',
    line: 'bg-amber-500',
    dot: 'bg-amber-500',
    emptyTitle: 'Sin pedidos por confirmar',
    emptyDescription: 'Los nuevos ingresos apareceran aqui para validacion inmediata.',
  },
  {
    status: 'confirmed',
    label: 'Confirmados',
    badge: 'bg-blue-100 text-blue-800',
    softBg: 'bg-white',
    line: 'bg-blue-500',
    dot: 'bg-blue-500',
    emptyTitle: 'Sin pedidos confirmados',
    emptyDescription: 'Esta columna concentra pedidos listos para pasar a preparacion.',
  },
  {
    status: 'preparing',
    label: 'En preparacion',
    badge: 'bg-violet-100 text-violet-800',
    softBg: 'bg-white',
    line: 'bg-violet-500',
    dot: 'bg-violet-500',
    emptyTitle: 'Nada en cocina',
    emptyDescription: 'Cuando un pedido entre a produccion se mostrara con prioridad de tiempo.',
  },
  {
    status: 'ready',
    label: 'Listos',
    badge: 'bg-emerald-100 text-emerald-800',
    softBg: 'bg-white',
    line: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    emptyTitle: 'Sin pedidos listos',
    emptyDescription: 'Los pedidos listos para entrega o servicio quedaran visibles aqui.',
  },
  {
    status: 'served',
    label: 'Servidos',
    badge: 'bg-slate-200 text-slate-700',
    softBg: 'bg-white',
    line: 'bg-slate-500',
    dot: 'bg-slate-500',
    emptyTitle: 'Sin pedidos servidos',
    emptyDescription: 'Usa esta columna para cerrar el ciclo operativo y cobrar cuando aplique.',
  },
];

function reducer(state: Order[], action: Action): Order[] {
  switch (action.type) {
    case 'SET':
      return action.orders;
    case 'ADD':
      if (state.some((order) => order._id === action.order._id)) return state;
      if (!LIVE_STATUSES.includes(action.order.status)) return state;
      return [action.order, ...state];
    case 'UPSERT':
      if (!LIVE_STATUSES.includes(action.order.status)) return state;
      if (state.some((order) => order._id === action.order._id)) {
        return state.map((order) => (order._id === action.order._id ? action.order : order));
      }
      return [action.order, ...state];
    case 'STATUS':
      if (TERMINAL_STATUSES.includes(action.status)) {
        return state.filter((order) => order._id !== action.orderId);
      }
      return state.map((order) =>
        order._id === action.orderId ? { ...order, status: action.status } : order
      );
    case 'ITEM_ADDED':
      return state.map((order) => {
        if (order._id !== action.orderId) return order;
        if (order.items.some((item) => item._id === action.item._id)) return order;
        return { ...order, items: [...order.items, action.item] };
      });
    default:
      return state;
  }
}

function getTableName(order: Order): string {
  if (typeof order.table === 'object' && order.table) {
    return (order.table as { name?: string }).name || 'Mesa';
  }
  if (order.orderType === 'dine_in') return 'Salon';
  return 'Canal directo';
}

function getNextActions(status: OrderStatus): NextAction[] {
  if (status === 'pending_confirmation') {
    return [
      { label: 'Confirmar pedido', newStatus: 'confirmed', icon: <CheckCircle2 size={14} />, variant: 'primary' },
      { label: 'Rechazar', newStatus: 'cancelled', icon: <XCircle size={14} />, variant: 'danger' },
    ];
  }
  if (status === 'confirmed') {
    return [
      { label: 'Iniciar preparacion', newStatus: 'preparing', icon: <UtensilsCrossed size={14} />, variant: 'primary' },
    ];
  }
  if (status === 'preparing') {
    return [{ label: 'Marcar listo', newStatus: 'ready', icon: <CheckCircle2 size={14} />, variant: 'primary' }];
  }
  if (status === 'ready') {
    return [{ label: 'Marcar servido', newStatus: 'served', icon: <Truck size={14} />, variant: 'primary' }];
  }
  if (status === 'served') {
    return [{ label: 'Cobrar pedido', newStatus: 'billed', icon: <Receipt size={14} />, variant: 'primary' }];
  }
  return [];
}

function getOrderTypeMeta(orderType: OrderType): TypeMeta {
  const config: Record<OrderType, TypeMeta> = {
    delivery: { label: 'Delivery', icon: <Truck size={12} />, badgeClass: 'bg-slate-900 text-white' },
    dine_in: { label: 'Salon', icon: <UtensilsCrossed size={12} />, badgeClass: 'bg-slate-100 text-slate-700' },
    takeaway: { label: 'Recojo', icon: <Store size={12} />, badgeClass: 'bg-slate-100 text-slate-700' },
    manual: { label: 'Manual', icon: <Receipt size={12} />, badgeClass: 'bg-slate-100 text-slate-700' },
  };

  return config[orderType];
}

function getElapsedMeta(order: Order) {
  const minutes = differenceInMinutes(new Date(), new Date(order.createdAt));
  const compact = formatDistanceToNowStrict(new Date(order.createdAt), {
    locale: es,
    unit: minutes >= 60 ? 'hour' : 'minute',
  });

  if (minutes >= 25) {
    return {
      minutes,
      label: `${minutes} min`,
      compact,
      chipClass: 'border border-red-200 bg-red-50 text-red-700',
      dotClass: 'bg-red-500',
      accentClass: 'ring-1 ring-red-200 border-red-200',
      priorityLabel: 'Retrasado',
      priorityClass: 'bg-red-50 text-red-700',
    };
  }

  if (minutes >= 15) {
    return {
      minutes,
      label: `${minutes} min`,
      compact,
      chipClass: 'border border-amber-200 bg-amber-50 text-amber-700',
      dotClass: 'bg-amber-500',
      accentClass: 'ring-1 ring-amber-200 border-amber-200',
      priorityLabel: 'Atencion',
      priorityClass: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    minutes,
    label: `${minutes} min`,
    compact,
    chipClass: 'border border-slate-200 bg-slate-50 text-slate-600',
    dotClass: 'bg-emerald-500',
    accentClass: 'border-slate-200',
    priorityLabel: 'En tiempo',
    priorityClass: 'bg-emerald-50 text-emerald-700',
  };
}

function getPrimaryCustomer(order: Order): string {
  return order.customerInfo?.name || getTableName(order);
}

function getSecondaryDetail(order: Order): string {
  if (order.orderType === 'delivery') return order.customerInfo?.address || 'Direccion pendiente';
  if (order.orderType === 'takeaway') return order.customerInfo?.phone || 'Recojo en local';
  return `${order.items.length} item${order.items.length !== 1 ? 's' : ''} / ${order.participants.length} comensal${order.participants.length !== 1 ? 'es' : ''}`;
}

function getItemsPreview(order: Order): string {
  const names = order.items.slice(0, 2).map((item) => `${item.quantity}x ${item.productSnapshot.name}`);
  if (order.items.length <= 2) return names.join(' / ');
  return `${names.join(' / ')} +${order.items.length - 2}`;
}

function ColumnEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 text-center">
      <div className="mb-4 rounded-full border border-slate-200 bg-white p-3 text-slate-400 shadow-sm">
        <CircleDashed size={18} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-[220px] text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function DetailRow({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs text-slate-600">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-slate-400">{icon}</span>
        <div className="min-w-0">{children}</div>
      </div>
      {action}
    </div>
  );
}

function OrderDetail({
  order,
  updatingId,
  onChangeStatus,
  standalone = false,
}: {
  order: Order;
  updatingId: string | null;
  onChangeStatus: (orderId: string, status: OrderStatus) => void;
  standalone?: boolean;
}) {
  const actions = getNextActions(order.status);

  return (
    <div className={cn(standalone ? 'space-y-3' : 'border-t border-slate-200 bg-slate-50/70 px-4 py-3')}>
      <div className="space-y-3">
        {order.customerInfo && (
          <div className="grid gap-2">
            <DetailRow icon={<User size={13} />}>
              <p className="font-medium text-slate-700">{order.customerInfo.name}</p>
            </DetailRow>
            {order.customerInfo.phone && (
              <DetailRow icon={<Phone size={13} />}>
                <p>{order.customerInfo.phone}</p>
              </DetailRow>
            )}
            {order.customerInfo.address && (
              <DetailRow
                icon={<MapPin size={13} />}
                action={
                  order.customerInfo.coordinates ? (
                    <a
                      href={`https://www.google.com/maps?q=${order.customerInfo.coordinates.lat},${order.customerInfo.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-medium text-slate-700 underline decoration-slate-300 underline-offset-2"
                    >
                      Ver mapa
                    </a>
                  ) : undefined
                }
              >
                <p className="max-w-[260px] break-words">{order.customerInfo.address}</p>
              </DetailRow>
            )}
          </div>
        )}

        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item._id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.quantity}x {item.productSnapshot.name}</p>
                  {item.addedByAlias && (
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                      Cargado por {item.addedByAlias}
                    </p>
                  )}
                  {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatCurrency(item.totalPrice)}</p>
              </div>

              {item.modifiers.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">+ {item.modifiers.map((modifier) => modifier.optionName).join(', ')}</p>
              )}

              {item.selectedGroups.length > 0 && (
                <div className="mt-1 space-y-1">
                  {item.selectedGroups.map((group) => (
                    <p key={group.groupId} className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{group.groupName}:</span>{' '}
                      {group.selectedOptions.map((option) => option.optionName).join(', ')}
                    </p>
                  ))}
                </div>
              )}

              {item.selectedMenuGroups.length > 0 && (
                <div className="mt-1 space-y-1">
                  {item.selectedMenuGroups.map((group) => (
                    <p key={group.groupId} className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{group.groupName}:</span>{' '}
                      {group.omitted ? `Sin ${group.groupName.toLowerCase()}` : group.selectedProductName}
                    </p>
                  ))}
                </div>
              )}

              {item.selectedAccompaniments.length > 0 && (
                <div className="mt-1 space-y-1">
                  {item.selectedAccompaniments.map((accompaniment, index) => (
                    <p
                      key={`${accompaniment.categoryId}-${accompaniment.productId}-${index}`}
                      className="text-xs text-slate-500"
                    >
                      <span className="font-medium text-slate-600">{accompaniment.categoryName}:</span>{' '}
                      {accompaniment.productName}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {order.surcharge > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            <span>Cargo adicional</span>
            <span className="font-medium text-slate-800">+{formatCurrency(order.surcharge)}</span>
          </div>
        )}

        {actions.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.slice(1).map((action) => (
              <Button
                key={action.newStatus}
                variant={action.variant}
                size="sm"
                icon={action.icon}
                loading={updatingId === order._id}
                onClick={() => onChangeStatus(order._id, action.newStatus)}
                className="rounded-lg"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanOrderCard({
  order,
  updatingId,
  onOpen,
  onChangeStatus,
}: {
  order: Order;
  updatingId: string | null;
  onOpen: () => void;
  onChangeStatus: (orderId: string, status: OrderStatus) => void;
}) {
  const elapsed = getElapsedMeta(order);
  const typeMeta = getOrderTypeMeta(order.orderType);
  const actions = getNextActions(order.status);
  const primaryAction = actions[0];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'rounded-xl border bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/30',
        elapsed.accentClass
      )}
    >
      <div className="flex items-stretch">
        <div className={cn('w-1 rounded-l-xl', elapsed.dotClass)} />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', typeMeta.badgeClass)}>
                  {typeMeta.icon}
                  {typeMeta.label}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">#{order.orderNumber}</span>
              </div>

              <p className="mt-2 truncate text-base font-semibold text-slate-950">{getPrimaryCustomer(order)}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{getSecondaryDetail(order)}</p>
            </div>

            <div className="text-right">
              <div className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold', elapsed.chipClass)}>
                <Clock3 size={12} />
                {elapsed.label}
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(order.total)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-700">{getItemsPreview(order)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', elapsed.priorityClass)}>
                  {elapsed.priorityLabel}
                </span>
                <span className="text-[11px] text-slate-400">{elapsed.compact}</span>
              </div>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {primaryAction ? (
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <Button
                variant={primaryAction.variant}
                size="sm"
                icon={primaryAction.icon}
                loading={updatingId === order._id}
                onClick={(event) => {
                  event.stopPropagation();
                  onChangeStatus(order._id, primaryAction.newStatus);
                }}
                className="h-10 justify-between rounded-lg px-3 text-sm shadow-sm"
              >
                <span>{primaryAction.label}</span>
                <ArrowRight size={14} />
              </Button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Ver detalle"
              >
                <List size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <List size={16} />
              Ver detalle
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export const OrdersLivePage: React.FC = () => {
  const { socket } = useSocketStore();
  const [orders, dispatch] = useReducer(reducer, []);
  const ordersRef = React.useRef(orders);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('orders_view') as ViewMode) ?? 'kanban'
  );

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders/live/all');
      dispatch({ type: 'SET', orders: response.data.data });
    } catch {
      // Keep the board usable even if a refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => fetchOrders();
    const onCreated = (order: Order) => dispatch({ type: 'ADD', order });
    const onStatusChanged = async (payload: { orderId: string; status: OrderStatus }) => {
      const alreadyLoaded = ordersRef.current.some((order) => order._id === payload.orderId);

      if (!alreadyLoaded && LIVE_STATUSES.includes(payload.status)) {
        try {
          const response = await api.get(`/orders/${payload.orderId}`);
          dispatch({ type: 'UPSERT', order: response.data.data });
        } catch {
          // Ignore transient socket refresh mismatch.
        }
        return;
      }

      dispatch({ type: 'STATUS', orderId: payload.orderId, status: payload.status });
    };
    const onItemAdded = (payload: { orderId: string; item: OrderItem }) => {
      dispatch({ type: 'ITEM_ADDED', orderId: payload.orderId, item: payload.item });
    };

    socket.on('connect', onConnect);
    socket.on('order:created', onCreated);
    socket.on('order:statusChanged', onStatusChanged);
    socket.on('order:itemAdded', onItemAdded);

    return () => {
      socket.off('connect', onConnect);
      socket.off('order:created', onCreated);
      socket.off('order:statusChanged', onStatusChanged);
      socket.off('order:itemAdded', onItemAdded);
    };
  }, [socket, fetchOrders]);

  const changeStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      dispatch({ type: 'STATUS', orderId, status });
      toast.success('Estado actualizado');
    } catch {
      toast.error('No se pudo actualizar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('orders_view', mode);
  };

  const selectedOrder = useMemo(
    () => orders.find((order) => order._id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const ordersByColumn = useMemo(() => {
    return COLUMNS.reduce<Record<OrderStatus, Order[]>>((acc, column) => {
      acc[column.status] = orders
        .filter((order) => order.status === column.status)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return acc;
    }, {} as Record<OrderStatus, Order[]>);
  }, [orders]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders]
  );

  const KanbanView = (
    <div className="grid min-h-[68vh] gap-4 xl:grid-cols-5">
      {COLUMNS.map((column) => {
        const columnOrders = ordersByColumn[column.status];
        const oldest = columnOrders[0] ? getElapsedMeta(columnOrders[0]).label : 'Sin cola';

        return (
          <section
            key={column.status}
            className={cn('min-w-0 rounded-2xl border border-slate-200 shadow-sm', column.softBg)}
          >
            <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
              <div className={cn('mb-3 h-1 w-12 rounded-full', column.line)} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', column.dot)} />
                    <h2 className="text-sm font-semibold text-slate-900">{column.label}</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Mayor espera: {oldest}</p>
                </div>
                <span className={cn('inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 text-xs font-semibold', column.badge)}>
                  {columnOrders.length}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-3">
              {columnOrders.length === 0 ? (
                <ColumnEmptyState title={column.emptyTitle} description={column.emptyDescription} />
              ) : (
                columnOrders.map((order) => (
                  <KanbanOrderCard
                    key={order._id}
                    order={order}
                    updatingId={updatingId}
                    onOpen={() => setSelectedOrderId(order._id)}
                    onChangeStatus={changeStatus}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

  const ListView = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {sortedOrders.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 rounded-full border border-slate-200 bg-slate-50 p-3 text-slate-400">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm font-semibold text-slate-700">Sin pedidos activos</p>
          <p className="mt-1 text-xs text-slate-500">Cuando ingrese actividad veras aqui una vista tabular compacta.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pedido</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cliente</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Estado</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tiempo</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente accion</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => {
                const elapsed = getElapsedMeta(order);
                const typeMeta = getOrderTypeMeta(order.orderType);
                const actions = getNextActions(order.status);
                const primaryAction = actions[0];

                return (
                  <tr
                    key={order._id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => setSelectedOrderId(order._id)}
                  >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', typeMeta.badgeClass)}>
                            {typeMeta.icon}
                            {typeMeta.label}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
                            <p className="text-xs text-slate-500">{getTableName(order)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{getPrimaryCustomer(order)}</p>
                        <p className="max-w-[280px] truncate text-xs text-slate-500">{getSecondaryDetail(order)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold', elapsed.chipClass)}>
                          <Clock3 size={12} />
                          {elapsed.label}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {primaryAction && (
                            <Button
                              variant={primaryAction.variant}
                              size="sm"
                              icon={primaryAction.icon}
                              loading={updatingId === order._id}
                              onClick={(event) => {
                                event.stopPropagation();
                                changeStatus(order._id, primaryAction.newStatus);
                              }}
                              className="rounded-lg"
                            >
                              {primaryAction.label}
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedOrderId(order._id);
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            Detalle
                          </button>
                        </div>
                      </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Operacion en vivo
              </span>
              {loading && <span className="text-xs text-slate-400">Actualizando...</span>}
            </div>
          </div>
          <p className="max-w-2xl text-sm text-slate-500">
            Tablero operativo para confirmar, producir, entregar y cerrar pedidos con lectura rapida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => handleViewMode('kanban')}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all',
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <LayoutGrid size={15} />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => handleViewMode('list')}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all',
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <List size={15} />
              Lista
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={fetchOrders}
            loading={loading}
            className="h-9 rounded-lg"
          >
            Actualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setManualModalOpen(true)}
            className="h-9 rounded-lg"
          >
            Orden manual
          </Button>
        </div>
      </header>

      {viewMode === 'kanban' ? KanbanView : ListView}

      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        size="3xl"
        title={
          selectedOrder ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold', getOrderTypeMeta(selectedOrder.orderType).badgeClass)}>
                    {getOrderTypeMeta(selectedOrder.orderType).icon}
                    {getOrderTypeMeta(selectedOrder.orderType).label}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    #{selectedOrder.orderNumber}
                  </span>
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-950">{getPrimaryCustomer(selectedOrder)}</p>
                  <p className="text-sm text-slate-500">{getSecondaryDetail(selectedOrder)}</p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold', getElapsedMeta(selectedOrder).chipClass)}>
                  <Clock3 size={12} />
                  {getElapsedMeta(selectedOrder).label}
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(selectedOrder.total)}</p>
              </div>
            </div>
          ) : null
        }
      >
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            updatingId={updatingId}
            onChangeStatus={changeStatus}
            standalone
          />
        )}
      </Modal>

      <CreateManualOrderModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onCreated={(order) => {
          dispatch({ type: 'UPSERT', order });
          setManualModalOpen(false);
          toast.success(`Orden #${order.orderNumber} creada`);
        }}
      />
    </div>
  );
};
