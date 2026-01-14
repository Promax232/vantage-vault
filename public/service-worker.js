const CACHE_NAME = 'vantage-cache-v1';
const urlsToCache = [
  '/',
  '/vantage',
  '/public/manifest.json',
  '/public/layout.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
