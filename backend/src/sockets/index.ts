import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt.utils';

let io: SocketServer;

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function initializeSockets(server: Server): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: [env.ADMIN_APP_URL, env.CUSTOMER_APP_URL],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Staff namespace (requires auth)
  const staffNs = io.of('/staff');

  staffNs.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  staffNs.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`Staff connected: ${user.userId} (${user.role})`);

    // Join restaurant room
    if (user.restaurantId) {
      socket.join(`restaurant:${user.restaurantId}`);

      if (user.role === 'kitchen') {
        socket.join(`kitchen:${user.restaurantId}`);
      }
    }

    socket.on('join:table', (tableId: string) => {
      socket.join(`table:${tableId}`);
    });

    socket.on('leave:table', (tableId: string) => {
      socket.leave(`table:${tableId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Staff disconnected: ${user.userId}`);
    });
  });

  // Customer namespace (public)
  const customerNs = io.of('/customer');

  customerNs.on('connection', (socket) => {
    console.log(`Customer connected: ${socket.id}`);

    socket.on('join:table', (tableId: string) => {
      socket.join(`table:${tableId}`);
      console.log(`Customer joined table room: ${tableId}`);
    });

    socket.on('leave:table', (tableId: string) => {
      socket.leave(`table:${tableId}`);
    });

    // For delivery/takeaway orders (no table) — subscribe to order-level events
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
      console.log(`Customer joined order room: ${orderId}`);
    });

    socket.on('leave:order', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Customer disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}
