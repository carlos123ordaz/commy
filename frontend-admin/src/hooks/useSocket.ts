import { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const { socket, isConnected, connect, disconnect } = useSocketStore();
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect(accessToken);
    }
    return () => {
      if (!isAuthenticated) disconnect();
    };
  }, [isAuthenticated, accessToken, connect, disconnect]);

  return { socket, isConnected };
}
