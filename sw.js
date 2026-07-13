const CACHE_NAME = 'snj-billing-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Fallback to cache if network fails (offline-first)
        return caches.match('/index.html');
      });
    })
  );
});
