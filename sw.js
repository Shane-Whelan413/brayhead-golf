// BHGS Service Worker — Push Notifications + Auto Update
const CACHE_VERSION = 'bhgs-v3';

self.addEventListener('install', e => {
  // Take control immediately — don't wait for old SW to finish
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Clean up old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
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
    data:    { url: data.url || '/brayhead-golf/' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification tap
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/brayhead-golf/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('brayhead-golf') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Listen for skip waiting message from app
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
