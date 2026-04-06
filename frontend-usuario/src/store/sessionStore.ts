import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, TableInfo, CustomerInfo, GoogleCustomer } from '../types';

interface SessionStore {
  sessionId: string;
  alias?: string;
  googleCustomer?: GoogleCustomer;
  // Table-based ordering
  tableToken?: string;
  tableInfo?: TableInfo;
  // Channel-based ordering (delivery/takeaway)
  channelToken?: string;
  channelType?: 'delivery' | 'takeaway';
  channelRestaurantId?: string;
  channelCustomerInfo?: CustomerInfo;
  // Shared
  orderId?: string;
  order?: Order;
  setSession: (data: { sessionId: string; alias?: string; tableToken: string; tableInfo: TableInfo }) => void;
  setChannelSession: (data: {
    channelToken: string;
    channelType: 'delivery' | 'takeaway';
    channelRestaurantId: string;
    customerInfo: CustomerInfo;
  }) => void;
  setOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  setAlias: (alias: string) => void;
  setGoogleCustomer: (customer: GoogleCustomer) => void;
  updateGoogleCustomerProfile: (data: { phone?: string; address?: string }) => void;
  clearGoogleCustomer: () => void;
  clearOrder: () => void;
  clearSession: () => void;
}

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      sessionId: generateSessionId(),
      alias: undefined,
      googleCustomer: undefined,
      tableToken: undefined,
      tableInfo: undefined,
      orderId: undefined,
      order: undefined,

      setSession: (data) =>
        set({
          tableToken: data.tableToken,
          tableInfo: data.tableInfo,
          alias: data.alias,
          // Clear channel state when starting a table session
          channelToken: undefined,
          channelType: undefined,
          channelRestaurantId: undefined,
          channelCustomerInfo: undefined,
        }),

      setChannelSession: (data) =>
        set({
          channelToken: data.channelToken,
          channelType: data.channelType,
          channelRestaurantId: data.channelRestaurantId,
          channelCustomerInfo: data.customerInfo,
          // Clear table state and previous order when starting a new channel session
          tableToken: undefined,
          tableInfo: undefined,
          orderId: undefined,
          order: undefined,
        }),

      setOrder: (order) => set({ order, orderId: order._id }),
      updateOrder: (order) => set({ order }),
      setAlias: (alias) => set({ alias }),
      setGoogleCustomer: (customer) => set({ googleCustomer: customer, alias: customer.name }),
      updateGoogleCustomerProfile: (data) =>
        set((state) => ({
          googleCustomer: state.googleCustomer ? { ...state.googleCustomer, ...data } : undefined,
        })),
      clearGoogleCustomer: () => set({ googleCustomer: undefined }),
      clearOrder: () => set({ orderId: undefined, order: undefined }),
      clearSession: () =>
        set({
          tableToken: undefined,
          tableInfo: undefined,
          channelToken: undefined,
          channelType: undefined,
          channelRestaurantId: undefined,
          channelCustomerInfo: undefined,
          orderId: undefined,
          order: undefined,
          alias: undefined,
          googleCustomer: undefined,
        }),
    }),
    {
      name: 'commy-session',
      partialize: (state) => ({
        sessionId: state.sessionId,
        alias: state.alias,
        googleCustomer: state.googleCustomer,
        tableToken: state.tableToken,
        channelToken: state.channelToken,
        channelType: state.channelType,
        channelRestaurantId: state.channelRestaurantId,
        channelCustomerInfo: state.channelCustomerInfo,
        orderId: state.orderId,
      }),
    }
  )
);
