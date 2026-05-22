// BHGS Service Worker — Push Notifications
const CACHE_NAME = 'bhgs-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', e => {
  if (!e.data) return;

  let data;
  try { data = e.data.json(); }
  catch { data = { title: 'BHGS', body: e.data.text() }; }

  const title   = data.title || 'Bray Head Golf Society';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/brayhead-golf/icon-192.png',
    badge:   data.badge || '/brayhead-golf/icon-192.png',
    tag:     data.tag   || 'bhgs-notification',
    data:    data.url   ? { url: data.url } : {},
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification tap — open or focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/brayhead-golf/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('brayhead-golf') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
