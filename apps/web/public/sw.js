// SGMS bildirim service worker — masaüstü/mobil uygulama kurmadan tarayıcı üzerinden
// push bildirimi almayı sağlar (resepsiyon giriş/çıkış, yeni mesaj vb.).

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SGMS', body: event.data.text() };
  }

  const title = payload.title || 'SGMS';
  const options = {
    body: payload.body || '',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: payload.tag || 'sgms-notification',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
