const CACHE_NAME = 'aviator-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/base.html',
  '/dashboard.html',
  '/profile.html',
  '/style.css',
  '/script.js',
  '/auth.js',
  '/images/logo.svg',
  '/images/classybetaviator-logo.png',
  '/cbpoweredby.png',
  '/poweredbyspribe.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Exclude API calls from caching - let browser handle them directly
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.includes('socket.io')) {
    return;
  }

  // Network First strategy for HTML files (navigational requests)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with new version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache First strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
      .then(() => self.clients.claim())
  );
});
