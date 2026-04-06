import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { socketUrl, api } from '../config/api';
import { useSessionStore } from '../store/sessionStore';

/**
 * Socket hook for delivery/takeaway orders (no table room).
 * Subscribes to `order:{orderId}` to receive status updates.
 */
export function useOrderSocket(orderId?: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const socket = io(`${socketUrl}/customer`, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    let initialConnect = true;

    socket.on('connect', () => {
      socket.emit('join:order', orderId);
      if (!initialConnect) {
        // Re-fetch order to recover missed events
        const { setOrder } = useSessionStore.getState();
        api
          .get(`/orders/${orderId}`)
          .then((res) => setOrder(res.data.data))
          .catch(() => {});
      }
      initialConnect = false;
    });

    socket.on('order:statusChanged', (data: { orderId: string; status: string }) => {
      if (data.orderId !== orderId) return;
      const { order, updateOrder } = useSessionStore.getState();
      if (!order) return;
      updateOrder({ ...order, status: data.status as typeof order.status });
    });

    socketRef.current = socket;

    return () => {
      socket.emit('leave:order', orderId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId]);

  return socketRef.current;
}
