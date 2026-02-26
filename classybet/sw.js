const CACHE_NAME = 'aviator-cache-v3';

// Only pre-cache truly static/immutable assets (images, icons)
const urlsToCache = [
  '/images/logo.svg',
  '/images/classybetcasino-logo.jpeg',
  '/cbpoweredby.png',
  '/poweredbyspribe.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Exclude API calls and socket.io from caching entirely
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.includes('socket.io')) {
    return;
  }

  // Network First for everything (HTML, CSS, JS)
  // Try network first, fall back to cache, and update cache on success
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Don't cache non-ok responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Update cache with fresh version
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Network failed — fall back to cache (offline support)
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  // Purge ALL old caches (anything not matching current CACHE_NAME)
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
      .then(() => self.clients.claim())
  );
});
