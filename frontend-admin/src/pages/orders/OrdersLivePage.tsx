import React, { useEffect, useReducer, useCallback, useState } from 'react';
import {
  Clock, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, ChefHat, Truck, Receipt, Plus,
  LayoutGrid, List,
} from 'lucide-react';
import type { Order, OrderStatus, OrderItem } from '../../types';
import { api } from '../../config/api';
import { useSocketStore } from '../../store/socketStore';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/format';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { CreateManualOrderModal } from './CreateManualOrderModal';

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'list';

type Action =
  | { type: 'SET'; orders: Order[] }
  | { type: 'ADD'; order: Order }
  | { type: 'UPSERT'; order: Order }
  | { type: 'STATUS'; orderId: string; status: OrderStatus }
  | { type: 'ITEM_ADDED'; orderId: string; item: OrderItem };

const LIVE_STATUSES: OrderStatus[] = ['pending_confirmation', 'confirmed', 'preparing', 'ready', 'served'];
const TERMINAL_STATUSES: OrderStatus[] = ['billed', 'closed', 'cancelled'];

function reducer(state: Order[], action: Action): Order[] {
  switch (action.type) {
    case 'SET':
      return action.orders;
    case 'ADD': {
      if (state.some((o) => o._id === action.order._id)) return state;
      if (!LIVE_STATUSES.includes(action.order.status)) return state;
      return [action.order, ...state];
    }
    case 'UPSERT': {
      if (!LIVE_STATUSES.includes(action.order.status)) return state;
      if (state.some((o) => o._id === action.order._id)) {
        return state.map((o) => (o._id === action.order._id ? action.order : o));
      }
      return [action.order, ...state];
    }
    case 'STATUS': {
      if (TERMINAL_STATUSES.includes(action.status)) {
        return state.filter((o) => o._id !== action.orderId);
      }
      return state.map((o) =>
        o._id === action.orderId ? { ...o, status: action.status } : o
      );
    }
    case 'ITEM_ADDED': {
      return state.map((o) => {
        if (o._id !== action.orderId) return o;
        if (o.items.some((i) => i._id === action.item._id)) return o;
        return { ...o, items: [...o.items, action.item] };
      });
    }
    default:
      return state;
  }
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'pending_confirmation', label: 'Pendientes', color: 'border-amber-400 bg-amber-50' },
  { status: 'confirmed', label: 'Confirmados', color: 'border-blue-400 bg-blue-50' },
  { status: 'preparing', label: 'En preparación', color: 'border-purple-400 bg-purple-50' },
  { status: 'ready', label: 'Listos', color: 'border-emerald-400 bg-emerald-50' },
  { status: 'served', label: 'Servidos', color: 'border-orange-400 bg-orange-50' },
];

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: '',
  takeaway: '🥡 Llevar',
  delivery: '🛵 Delivery',
  manual: '✍️ Manual',
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function getTableName(order: Order): string {
  if (typeof order.table === 'object' && order.table) {
    return (order.table as { name: string }).name;
  }
  return ORDER_TYPE_LABEL[order.orderType] || 'Sin mesa';
}

type NextAction = {
  label: string;
  newStatus: OrderStatus;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
};

function getNextActions(status: OrderStatus): NextAction[] {
  if (status === 'pending_confirmation') return [
    { label: 'Confirmar', newStatus: 'confirmed', icon: <CheckCircle2 size={14} />, variant: 'primary' },
    { label: 'Rechazar', newStatus: 'cancelled', icon: <XCircle size={14} />, variant: 'danger' },
  ];
  if (status === 'confirmed') return [
    { label: 'En preparación', newStatus: 'preparing', icon: <ChefHat size={14} />, variant: 'primary' },
  ];
  if (status === 'preparing') return [
    { label: 'Listo', newStatus: 'ready', icon: <CheckCircle2 size={14} />, variant: 'primary' },
  ];
  if (status === 'ready') return [
    { label: 'Servido', newStatus: 'served', icon: <Truck size={14} />, variant: 'primary' },
  ];
  if (status === 'served') return [
    { label: 'Cobrar', newStatus: 'billed', icon: <Receipt size={14} />, variant: 'primary' },
  ];
  return [];
}

// ── Shared: Order expanded detail (items + surcharge + actions) ────────────────

interface OrderDetailProps {
  order: Order;
  updatingId: string | null;
  onChangeStatus: (id: string, status: OrderStatus) => void;
}

function OrderDetail({ order, updatingId, onChangeStatus }: OrderDetailProps) {
  const actions = getNextActions(order.status);
  return (
    <>
      <div className="space-y-1.5 py-3">
        {order.items.map((item) => (
          <div key={item._id} className="flex items-start justify-between text-xs">
            <div className="flex-1">
              <span className="font-medium text-slate-700">
                {item.quantity}x {item.productSnapshot.name}
              </span>
              {item.addedByAlias && (
                <span className="ml-1 text-slate-400">({item.addedByAlias})</span>
              )}
              {item.selectedMenuGroups?.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {item.selectedMenuGroups.map((mg) => (
                    <p key={mg.groupId} className="text-slate-500">
                      <span className="font-medium">{mg.groupName}:</span>{' '}
                      {mg.omitted
                        ? <span className="italic text-slate-400">Sin {mg.groupName.toLowerCase()}</span>
                        : mg.selectedProductName}
                    </p>
                  ))}
                </div>
              )}
              {(!item.selectedMenuGroups?.length) && item.selectedGroups?.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {item.selectedGroups.map((sg) => (
                    <p key={sg.groupId} className="text-slate-500">
                      <span className="font-medium">{sg.groupName}:</span>{' '}
                      {sg.selectedOptions.map((o) => o.optionName).join(', ')}
                    </p>
                  ))}
                </div>
              )}
              {item.selectedAccompaniments?.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {item.selectedAccompaniments.map((a) => (
                    <p key={a.categoryId} className="text-slate-500">
                      <span className="font-medium">{a.categoryName}:</span>{' '}
                      {a.productName}
                    </p>
                  ))}
                </div>
              )}
              {item.modifiers.length > 0 && (
                <p className="text-slate-400">
                  + {item.modifiers.map((m) => m.optionName).join(', ')}
                </p>
              )}
              {item.notes && (
                <p className="text-slate-400 italic mt-0.5">💬 {item.notes}</p>
              )}
            </div>
            <span className="text-slate-700 font-medium ml-2">
              {formatCurrency(item.totalPrice)}
            </span>
          </div>
        ))}
      </div>

      {order.surcharge > 0 && (
        <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-50">
          <span>Cargo adicional ({order.orderType})</span>
          <span>+{formatCurrency(order.surcharge)}</span>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
          {actions.map((action) => (
            <Button
              key={action.newStatus}
              variant={action.variant}
              size="sm"
              icon={action.icon}
              loading={updatingId === order._id}
              onClick={() => onChangeStatus(order._id, action.newStatus)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const OrdersLivePage: React.FC = () => {
  const { socket } = useSocketStore();
  const [orders, dispatch] = useReducer(reducer, []);
  const ordersRef = React.useRef(orders);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('orders_view') as ViewMode) ?? 'kanban'
  );

  useEffect(() => { ordersRef.current = orders; }, [orders]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders/live/all');
      dispatch({ type: 'SET', orders: res.data.data });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => fetchOrders();
    const onCreated = (order: Order) => dispatch({ type: 'ADD', order });
    const onStatusChanged = async (payload: { orderId: string; status: OrderStatus }) => {
      const alreadyInState = ordersRef.current.some((o) => o._id === payload.orderId);
      if (!alreadyInState && LIVE_STATUSES.includes(payload.status)) {
        try {
          const res = await api.get(`/orders/${payload.orderId}`);
          dispatch({ type: 'UPSERT', order: res.data.data });
        } catch { /* ignore */ }
      } else {
        dispatch({ type: 'STATUS', orderId: payload.orderId, status: payload.status });
      }
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
      toast.error('Error al actualizar estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setExpandedId(null);
    localStorage.setItem('orders_view', mode);
  };

  // ── Kanban view ──────────────────────────────────────────────────────────────

  const KanbanView = (
    <div className="flex gap-4 overflow-x-auto pb-3 xl:grid xl:grid-cols-5 xl:overflow-visible min-h-[60vh]">
      {COLUMNS.map((col) => {
        const colOrders = orders.filter((o) => o.status === col.status);
        return (
          <div key={col.status} className={cn('flex-shrink-0 w-72 xl:w-auto rounded-xl border-t-4 bg-white shadow-sm', col.color)}>
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {colOrders.length}
                </span>
              </div>
            </div>

            <div className="p-3 space-y-3 max-h-[65vh] overflow-y-auto">
              {colOrders.length === 0 ? (
                <p className="text-center text-slate-300 text-sm py-8">Sin pedidos</p>
              ) : (
                colOrders.map((order) => {
                  const isExpanded = expandedId === order._id;
                  const elapsed = formatDistanceToNow(new Date(order.createdAt), { locale: es });
                  const tableName = getTableName(order);
                  const typeLabel = ORDER_TYPE_LABEL[order.orderType];

                  return (
                    <div key={order._id} className="bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : order._id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{tableName}</p>
                            {typeLabel && <p className="text-xs text-slate-500">{typeLabel}</p>}
                            <p className="text-xs text-slate-400 font-mono">#{order.orderNumber}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{formatCurrency(order.total)}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Clock size={11} />
                              {elapsed}
                            </div>
                          </div>
                        </div>

                        {order.customerInfo && (
                          <div className="text-xs text-slate-500 mb-2 bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
                            <p className="font-medium text-slate-700">{order.customerInfo.name}</p>
                            {order.customerInfo.phone && <p>📞 {order.customerInfo.phone}</p>}
                            {order.customerInfo.address && (
                              <div className="flex items-center justify-between gap-1">
                                <p className="truncate">📍 {order.customerInfo.address}</p>
                                {order.customerInfo.coordinates && (
                                  <a
                                    href={`https://www.google.com/maps?q=${order.customerInfo.coordinates.lat},${order.customerInfo.coordinates.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="shrink-0 text-xs text-primary-600 hover:text-primary-700 underline font-medium"
                                  >
                                    Ver mapa
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{order.items.length} ítems • {order.participants.length} comensal{order.participants.length !== 1 ? 'es' : ''}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-50 px-4 pb-4">
                          <OrderDetail order={order} updatingId={updatingId} onChangeStatus={changeStatus} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── List view ────────────────────────────────────────────────────────────────

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const ListView = (
    <div className="space-y-2">
      {sortedOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p>Sin pedidos activos</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mesa / Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ítems</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tiempo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => {
                  const isExpanded = expandedId === order._id;
                  const minutes = differenceInMinutes(new Date(), new Date(order.createdAt));
                  const isUrgent = minutes > 20;
                  const isWarning = minutes > 10 && !isUrgent;
                  const tableName = getTableName(order);
                  const typeLabel = ORDER_TYPE_LABEL[order.orderType];
                  const actions = getNextActions(order.status);

                  return (
                    <React.Fragment key={order._id}>
                      <tr
                        className={cn(
                          'border-b border-slate-50 transition-colors cursor-pointer',
                          isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : order._id)}
                      >
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">#{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{tableName}</p>
                          {typeLabel && <p className="text-xs text-slate-400">{typeLabel}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {order.items.length} ítem{order.items.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium',
                            isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'
                          )}>
                            <Clock size={11} />
                            {minutes}m
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 flex-wrap">
                            {actions.map((action) => (
                              <Button
                                key={action.newStatus}
                                variant={action.variant}
                                size="sm"
                                icon={action.icon}
                                loading={updatingId === order._id}
                                onClick={() => changeStatus(order._id, action.newStatus)}
                              >
                                {action.label}
                              </Button>
                            ))}
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                              title={isExpanded ? 'Colapsar' : 'Ver ítems'}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td colSpan={7} className="px-6 pb-4">
                            {order.customerInfo && (
                              <div className="text-xs text-slate-500 mt-3 mb-1 bg-white rounded-lg px-3 py-2 border border-slate-100 space-y-0.5 max-w-sm">
                                <p className="font-medium text-slate-700">{order.customerInfo.name}</p>
                                {order.customerInfo.phone && <p>📞 {order.customerInfo.phone}</p>}
                                {order.customerInfo.address && (
                                  <div className="flex items-center gap-2">
                                    <p className="truncate">📍 {order.customerInfo.address}</p>
                                    {order.customerInfo.coordinates && (
                                      <a
                                        href={`https://www.google.com/maps?q=${order.customerInfo.coordinates.lat},${order.customerInfo.coordinates.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-600 hover:text-primary-700 underline font-medium shrink-0"
                                      >
                                        Ver mapa
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <OrderDetail order={order} updatingId={updatingId} onChangeStatus={changeStatus} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sortedOrders.map((order) => {
              const isExpanded = expandedId === order._id;
              const minutes = differenceInMinutes(new Date(), new Date(order.createdAt));
              const isUrgent = minutes > 20;
              const isWarning = minutes > 10 && !isUrgent;
              const tableName = getTableName(order);
              const typeLabel = ORDER_TYPE_LABEL[order.orderType];
              const actions = getNextActions(order.status);

              return (
                <div
                  key={order._id}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : order._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{tableName}</p>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          #{order.orderNumber}
                          {typeLabel && <span className="ml-1">{typeLabel}</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(order.total)}</p>
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400'
                        )}>
                          <Clock size={10} />
                          {minutes}m
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                      <span>{order.items.length} ítem{order.items.length !== 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {/* Quick actions - always visible on mobile */}
                  {actions.length > 0 && (
                    <div className="px-4 pb-3 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {actions.map((action) => (
                        <Button
                          key={action.newStatus}
                          variant={action.variant}
                          size="sm"
                          icon={action.icon}
                          loading={updatingId === order._id}
                          onClick={() => changeStatus(order._id, action.newStatus)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 pb-4">
                      {order.customerInfo && (
                        <div className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg px-3 py-2 space-y-0.5">
                          <p className="font-medium text-slate-700">{order.customerInfo.name}</p>
                          {order.customerInfo.phone && <p>📞 {order.customerInfo.phone}</p>}
                          {order.customerInfo.address && <p>📍 {order.customerInfo.address}</p>}
                        </div>
                      )}
                      <OrderDetail order={order} updatingId={updatingId} onChangeStatus={changeStatus} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pedidos en Vivo</h1>
          <p className="text-slate-500 text-sm">{orders.length} pedidos activos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => handleViewMode('kanban')}
              title="Vista kanban"
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'kanban'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => handleViewMode('list')}
              title="Vista lista"
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'list'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <List size={16} />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setManualModalOpen(true)}
          >
            Orden manual
          </Button>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchOrders} loading={loading}>
            Actualizar
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' ? KanbanView : ListView}

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
