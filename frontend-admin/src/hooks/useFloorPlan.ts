import { useEffect, useMemo, useCallback, useRef, useReducer } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../config/api';
import { useSocketStore } from '../store/socketStore';
import type {
  Table,
  Order,
  Notification,
  FloorPlanResponse,
  TableStatus,
  OrderStatus,
  NotificationType,
  TableLayoutPosition,
} from '../types';

// ─── helpers ───────────────────────────────────────────────────────────────

function getDefaultLayout(index: number, total: number): TableLayoutPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: 80 + col * 170, y: 80 + row * 150, width: 120, height: 90, rotation: 0, shape: 'rounded' };
}

async function fetchFloorPlan(): Promise<FloorPlanResponse> {
  const res = await api.get('/floor-plan');
  return res.data.data;
}

async function fetchLiveOrders(): Promise<Order[]> {
  const res = await api.get('/orders/live/all');
  return res.data.data;
}

// ─── live state (useReducer) ────────────────────────────────────────────────

interface LiveOrderInfo {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

interface TableAlert {
  type: NotificationType;
  notificationId: string;
  message?: string;
}

interface LiveState {
  tableStatuses: Record<string, TableStatus>;
  tableOrders: Record<string, LiveOrderInfo>;
  tableAlerts: Record<string, TableAlert>;
}

type LiveAction =
  | { type: 'SEED_ORDERS'; orders: Order[] }
  | { type: 'ORDER_CREATED'; order: Order }
  | { type: 'ORDER_STATUS'; orderId: string; tableId: string; status: OrderStatus }
  | { type: 'TABLE_STATUS'; tableId: string; status: TableStatus }
  | { type: 'ALERT_NEW'; tableId: string; alert: TableAlert }
  | { type: 'ALERT_RESOLVED'; tableId: string }
  | { type: 'RESET' };

const initialLive: LiveState = { tableStatuses: {}, tableOrders: {}, tableAlerts: {} };

function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'SEED_ORDERS': {
      const tableOrders: Record<string, LiveOrderInfo> = { ...state.tableOrders };
      for (const order of action.orders) {
        const tableId =
          typeof order.table === 'string' ? order.table : (order.table as Table)._id;
        tableOrders[tableId] = {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          itemCount: order.items.length,
          createdAt: order.createdAt,
        };
      }
      return { ...state, tableOrders };
    }

    case 'ORDER_CREATED': {
      const tableId =
        typeof action.order.table === 'string'
          ? action.order.table
          : (action.order.table as Table)._id;
      return {
        ...state,
        tableOrders: {
          ...state.tableOrders,
          [tableId]: {
            orderId: action.order._id,
            orderNumber: action.order.orderNumber,
            status: action.order.status,
            total: action.order.total,
            itemCount: action.order.items.length,
            createdAt: action.order.createdAt,
          },
        },
        tableStatuses: {
          ...state.tableStatuses,
          [tableId]: state.tableStatuses[tableId] ?? 'with_order',
        },
      };
    }

    case 'ORDER_STATUS': {
      const { tableId, orderId, status } = action;
      const existing = state.tableOrders[tableId];
      const updatedOrders = existing && existing.orderId === orderId
        ? { ...state.tableOrders, [tableId]: { ...existing, status } }
        : state.tableOrders;

      if (status === 'closed' || status === 'cancelled') {
        const { [tableId]: _o, ...restOrders } = updatedOrders;
        const { [tableId]: _a, ...restAlerts } = state.tableAlerts;
        return {
          ...state,
          tableOrders: restOrders,
          tableAlerts: restAlerts,
          tableStatuses: { ...state.tableStatuses, [tableId]: 'free' },
        };
      }
      if (status === 'billed') {
        return {
          ...state,
          tableOrders: updatedOrders,
          tableStatuses: { ...state.tableStatuses, [tableId]: 'pending_payment' },
        };
      }
      return { ...state, tableOrders: updatedOrders };
    }

    case 'TABLE_STATUS': {
      const { tableId, status } = action;
      if (status === 'free') {
        const { [tableId]: _o, ...restOrders } = state.tableOrders;
        const { [tableId]: _a, ...restAlerts } = state.tableAlerts;
        return {
          ...state,
          tableOrders: restOrders,
          tableAlerts: restAlerts,
          tableStatuses: { ...state.tableStatuses, [tableId]: 'free' },
        };
      }
      return { ...state, tableStatuses: { ...state.tableStatuses, [tableId]: status } };
    }

    case 'ALERT_NEW':
      return { ...state, tableAlerts: { ...state.tableAlerts, [action.tableId]: action.alert } };

    case 'ALERT_RESOLVED': {
      const { [action.tableId]: _, ...rest } = state.tableAlerts;
      return { ...state, tableAlerts: rest };
    }

    case 'RESET':
      return initialLive;

    default:
      return state;
  }
}

// ─── public types ───────────────────────────────────────────────────────────

export interface EnrichedTable extends Table {
  layout: TableLayoutPosition;
  liveStatus: TableStatus;
  activeOrder?: LiveOrderInfo;
  hasAlert: boolean;
  alertType?: NotificationType;
}

// ─── hook ──────────────────────────────────────────────────────────────────

export function useFloorPlan() {
  const { socket } = useSocketStore();
  const queryClient = useQueryClient();
  const [live, dispatch] = useReducer(liveReducer, initialLive);
  const seededRef = useRef(false);

  const floorQuery = useQuery({
    queryKey: ['floor-plan'],
    queryFn: fetchFloorPlan,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['live-orders-floor'],
    queryFn: fetchLiveOrders,
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  // Seed live orders once on first fetch
  useEffect(() => {
    if (!ordersQuery.data || seededRef.current) return;
    seededRef.current = true;
    dispatch({ type: 'SEED_ORDERS', orders: ordersQuery.data });
  }, [ordersQuery.data]);

  // ── Socket handlers ───────────────────────────────────────────────────────

  const onOrderCreated = useCallback((order: Order) => {
    dispatch({ type: 'ORDER_CREATED', order });
  }, []);

  const onOrderStatusChanged = useCallback(
    (payload: { orderId: string; tableId?: string; status: OrderStatus; previousStatus: OrderStatus }) => {
      if (!payload.tableId) return;
      dispatch({ type: 'ORDER_STATUS', orderId: payload.orderId, tableId: payload.tableId, status: payload.status });
    },
    []
  );

  const onTableStatusChanged = useCallback(
    (payload: { tableId: string; status: TableStatus }) => {
      dispatch({ type: 'TABLE_STATUS', tableId: payload.tableId, status: payload.status });
    },
    []
  );

  const onNotificationNew = useCallback((notification: Notification) => {
    const tableId = notification.table._id;
    dispatch({
      type: 'ALERT_NEW',
      tableId,
      alert: { type: notification.type, notificationId: notification._id, message: notification.message },
    });
  }, []);

  const onNotificationResolved = useCallback((notification: Notification) => {
    const tableId = typeof notification.table === 'string' ? notification.table : notification.table._id;
    dispatch({ type: 'ALERT_RESOLVED', tableId });
  }, []);

  const onFloorPlanUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;
    socket.on('order:created', onOrderCreated);
    socket.on('order:statusChanged', onOrderStatusChanged);
    socket.on('table:statusChanged', onTableStatusChanged);
    socket.on('notification:new', onNotificationNew);
    socket.on('notification:resolved', onNotificationResolved);
    socket.on('floor_plan:updated', onFloorPlanUpdated);
    return () => {
      socket.off('order:created', onOrderCreated);
      socket.off('order:statusChanged', onOrderStatusChanged);
      socket.off('table:statusChanged', onTableStatusChanged);
      socket.off('notification:new', onNotificationNew);
      socket.off('notification:resolved', onNotificationResolved);
      socket.off('floor_plan:updated', onFloorPlanUpdated);
    };
  }, [socket, onOrderCreated, onOrderStatusChanged, onTableStatusChanged, onNotificationNew, onNotificationResolved, onFloorPlanUpdated]);

  // ── Merged data ───────────────────────────────────────────────────────────

  const enrichedTables = useMemo((): EnrichedTable[] => {
    const raw = floorQuery.data?.tables ?? [];
    const total = raw.length;
    return raw.map((table, idx) => ({
      ...table,
      layout: table.layout ?? getDefaultLayout(idx, total),
      liveStatus: live.tableStatuses[table._id] ?? table.status,
      activeOrder: live.tableOrders[table._id],
      hasAlert: !!live.tableAlerts[table._id],
      alertType: live.tableAlerts[table._id]?.type,
    }));
  }, [floorQuery.data, live]);

  const stats = useMemo(() => {
    const free = enrichedTables.filter((t) => t.liveStatus === 'free').length;
    const alerts = enrichedTables.filter((t) => t.hasAlert).length;
    const occupied = enrichedTables.length - free;
    return { free, occupied, alerts, total: enrichedTables.length };
  }, [enrichedTables]);

  // Derive all zone names (from tables + zoneLayouts)
  const zoneNames = useMemo(() => {
    const fromTables = (floorQuery.data?.tables ?? [])
      .map((t) => t.zone)
      .filter(Boolean) as string[];
    const fromLayouts = (floorQuery.data?.layout?.zoneLayouts ?? []).map((z) => z.zoneName);
    return [...new Set([...fromLayouts, ...fromTables])].sort();
  }, [floorQuery.data]);

  return {
    tables: enrichedTables,
    layout: floorQuery.data?.layout,
    zoneNames,
    stats,
    isLoading: floorQuery.isLoading,
    isError: floorQuery.isError,
    refetch: () => {
      floorQuery.refetch();
      ordersQuery.refetch();
      seededRef.current = false;
      dispatch({ type: 'RESET' });
    },
  };
}
