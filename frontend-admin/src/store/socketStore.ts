import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { socketUrl } from '../config/api';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: (token: string) => {
    const existing = get().socket;
    // Only skip if the socket exists AND is connected with the same auth
    if (existing && (existing.connected || existing.active)) return;

    // Clean up any previous socket
    if (existing) {
      existing.disconnect();
    }

    const socket = io(`${socketUrl}/staff`, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
