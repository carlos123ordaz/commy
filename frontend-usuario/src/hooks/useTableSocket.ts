import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { socketUrl, api } from '../config/api';
import { useSessionStore } from '../store/sessionStore';
import type { OrderItem } from '../types';

export function useTableSocket(tableId?: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tableId) return;

    const socket = io(`${socketUrl}/customer`, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    let initialConnect = true;

    const syncOrder = () => {
      const { orderId, setOrder } = useSessionStore.getState();
      if (!orderId) return;
      api
        .get(`/orders/${orderId}`)
        .then((res) => setOrder(res.data.data))
        .catch(() => {});
    };

    socket.on('connect', () => {
      socket.emit('join:table', tableId);
      // On reconnect (not initial connect), re-fetch order to recover missed events
      if (!initialConnect) {
        syncOrder();
      }
      initialConnect = false;
    });

    socket.on('disconnect', (reason) => {
      // If server closed the connection (not a client disconnect), log for debug
      if (reason === 'io server disconnect') {
        console.warn('[socket] Server closed connection, will reconnect');
      }
    });

    socket.on('order:itemAdded', (data: { orderId: string; item: OrderItem }) => {
      const { order, updateOrder } = useSessionStore.getState();
      if (!order || order._id !== data.orderId) return;
      // Deduplicate — in case both HTTP response and socket carry same item
      if (order.items.some((i) => i._id === data.item._id)) return;
      updateOrder({
        ...order,
        items: [...order.items, data.item],
        subtotal: order.subtotal + data.item.totalPrice,
        total: order.total + data.item.totalPrice,
      });
    });

    socket.on('order:itemRemoved', (data: { orderId: string; itemId: string }) => {
      const { order, updateOrder } = useSessionStore.getState();
      if (!order || order._id !== data.orderId) return;
      const removedItem = order.items.find((i) => i._id === data.itemId);
      const removedTotal = removedItem?.totalPrice ?? 0;
      updateOrder({
        ...order,
        items: order.items.filter((i) => i._id !== data.itemId),
        subtotal: order.subtotal - removedTotal,
        total: order.total - removedTotal,
      });
    });

    socket.on('order:itemUpdated', (data: { orderId: string; item: OrderItem }) => {
      const { order, updateOrder } = useSessionStore.getState();
      if (!order || order._id !== data.orderId) return;
      const newItems = order.items.map((i) => (i._id === data.item._id ? data.item : i));
      const newTotal = newItems.reduce((s, i) => s + i.totalPrice, 0);
      updateOrder({ ...order, items: newItems, subtotal: newTotal, total: newTotal });
    });

    socket.on('order:statusChanged', (data: { orderId: string; status: string }) => {
      const { order, updateOrder } = useSessionStore.getState();
      if (!order || order._id !== data.orderId) return;
      updateOrder({ ...order, status: data.status as typeof order.status });
    });

    socket.on('order:participantReady', (data: { orderId: string; readyParticipants: string[] }) => {
      const { order, updateOrder } = useSessionStore.getState();
      if (!order || order._id !== data.orderId) return;
      updateOrder({ ...order, readyParticipants: data.readyParticipants });
    });

    socketRef.current = socket;

    return () => {
      socket.emit('leave:table', tableId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tableId]);

  return socketRef.current;
}
