import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { registerPushSubscription, registerServiceWorker } from '../utils/pushNotifications';

type PermissionState = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const { isAuthenticated } = useAuthStore();
  const [permission, setPermission] = useState<PermissionState>(
    'Notification' in window ? (Notification.permission as PermissionState) : 'denied'
  );

  // Registrar SW al autenticar (no requiere gesto del usuario)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!('serviceWorker' in navigator)) return;

    registerServiceWorker().catch(() => {/* browser no lo soporta */});
  }, [isAuthenticated]);

  // Si ya se concedió el permiso anteriormente, suscribir automáticamente
  useEffect(() => {
    if (!isAuthenticated) return;
    if (permission !== 'granted') return;

    registerPushSubscription().catch(() => {/* error al suscribir */});
  }, [isAuthenticated, permission]);

  // Función para llamar desde un gesto del usuario (click en la campana)
  async function requestPermission(): Promise<void> {
    if (!('Notification' in window)) return;
    if (permission !== 'default') return;

    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);

    if (result === 'granted') {
      await registerPushSubscription().catch(() => {/* error al suscribir */});
    }
  }

  return { permission, requestPermission };
}
