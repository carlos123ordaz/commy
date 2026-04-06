self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Commy', body: event.data.text() };
  }

  const title = payload.title || 'Commy';
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, foco en ella
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // Si no, abrir una nueva
        if (clients.openWindow) return clients.openWindow('/notificaciones');
      })
  );
});
