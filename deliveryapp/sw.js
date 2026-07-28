const CACHE_NAME = 'dd-delivery-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/config.js',
  '/assets/js/api.js',
  '/assets/js/app.js',
  '/pages/home/home.html',
  '/pages/home/home.js',
  '/pages/order/order.html',
  '/pages/order/order.js',
  '/pages/earnings/earnings.html',
  '/pages/earnings/earnings.js',
  '/pages/profile/profile.html',
  '/pages/profile/profile.js'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls — always network
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"message":"Offline"}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Static assets — cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
