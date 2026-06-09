const CACHE_NAME = 'aviator-cache-v4';

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
  const request = event.request;
  const requestUrl = new URL(request.url);

  // Exclude non-GET requests (like POST), non-HTTP protocols (chrome-extension://),
  // API calls, socket.io, and third-party scripts from caching entirely.
  if (
    request.method !== 'GET' ||
    !requestUrl.protocol.startsWith('http') ||
    requestUrl.pathname.startsWith('/api/') || 
    requestUrl.pathname.includes('socket.io') ||
    requestUrl.hostname.includes('flutterwave.com') ||
    requestUrl.hostname.includes('posthog.com')
  ) {
    // Let the browser handle these normally (don't intercept)
    return;
  }

  // Network First for everything else (HTML, CSS, JS)
  // Try network first, fall back to cache, and update cache on success
  event.respondWith(
    fetch(request)
      .then(response => {
        // Don't cache non-ok responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Update cache with fresh version
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache).catch(err => console.error('SW cache error:', err));
        });
        return response;
      })
      .catch(() => {
        // Network failed — fall back to cache (offline support)
        return caches.match(request);
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
