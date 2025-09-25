const CACHE_NAME = 'sommos-v3';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/manifest.json',
  '/icons/wine-glass.svg',
  '/icons/favicon-32x32.svg'
];

// Only allow caching of lightweight API responses to avoid large data prefetches
const CACHEABLE_API_PATHS = new Set([
  '/api/system/health'
]);

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
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
  );
});

// Fetch event - Network first, then cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const isApiRequest = requestUrl.pathname.startsWith('/api/');
  const canCacheResponse = !isApiRequest || CACHEABLE_API_PATHS.has(requestUrl.pathname);

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && canCacheResponse) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        if (canCacheResponse) {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
        }

        if (isApiRequest) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Offline or server unavailable'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        const acceptHeader = event.request.headers.get('accept') || '';
        if (acceptHeader.includes('text/html')) {
          const fallback = await caches.match('/index.html');
          if (fallback) {
            return fallback;
          }
        }

        return Response.error();
      })
  );
});
