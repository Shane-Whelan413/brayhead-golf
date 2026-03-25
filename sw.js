const CACHE = 'brayhead-gs-v5';
const ASSETS = [
  '/brayhead-golf/index.html',
  '/brayhead-golf/manifest.json',
  '/brayhead-golf/icon-192.png',
  '/brayhead-golf/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache API or Supabase requests — always go to network
  if (e.request.url.includes('supabase.co') || e.request.url.includes('/rest/v1/')) return;
  // For app assets, try network first then fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
