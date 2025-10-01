// Import Workbox modules (only in service worker context)
if (typeof importScripts !== 'undefined') {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');
}

const PRECACHE_VERSION = 'v1';
const RUNTIME_VERSION = 'v1';
const PRECACHE_CACHE_NAME = `sommos-precache-${PRECACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `sommos-runtime-${RUNTIME_VERSION}`;
const STATIC_CACHE_NAME = `sommos-static-${RUNTIME_VERSION}`;
const API_CACHE_NAME = `sommos-api-${RUNTIME_VERSION}`;
const IMAGE_CACHE_NAME = `sommos-images-${RUNTIME_VERSION}`;
const CRITICAL_API_CACHE_NAME = `sommos-critical-api-${RUNTIME_VERSION}`;

// Implement strategic caching
// Each resource type uses an optimized caching strategy:
// - STATIC: Cache-first for JS/CSS/fonts (fast, versioned assets)
// - API: Network-first for API calls (fresh data priority, offline fallback)
// - IMAGES: Stale-while-revalidate for images (fast display, background updates)
const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  API: 'network-first',
  IMAGES: 'stale-while-revalidate'
};

// Pre-cache critical API routes
const CRITICAL_API_ROUTES = [
  '/api/inventory/stock',
  '/api/wines/catalog',
  '/api/system/health'
];

// Workbox configuration (only in service worker context)
if (typeof workbox !== 'undefined') {
  workbox.setConfig({
    debug: false
  });

  // Pre-cache critical API routes with Workbox
  workbox.precaching.precacheAndRoute(CRITICAL_API_ROUTES.map(route => ({
    url: route,
    revision: null // API routes don't have revisions
  })));

  // Configure Workbox strategies for different resource types
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' || 
                    request.destination === 'style' ||
                    request.url.includes('/assets/'),
    new workbox.strategies.CacheFirst({
      cacheName: STATIC_CACHE_NAME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 86400, // 24 hours
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: IMAGE_CACHE_NAME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 604800, // 7 days
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: API_CACHE_NAME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 300, // 5 minutes
        }),
      ],
    })
  );
}

const CACHEABLE_API_PATHS = new Set(['/api/system/health']);
const APP_SHELL_PATHS = ['/index.html', '/test-pairing.html', '/manifest.json'];

// Cache configuration
const CACHE_CONFIG = {
  STATIC: {
    maxAge: 86400000, // 24 hours
    maxEntries: 100
  },
  API: {
    maxAge: 300000, // 5 minutes
    maxEntries: 50
  },
  IMAGES: {
    maxAge: 604800000, // 7 days
    maxEntries: 200
  }
};

const manifestEntriesRaw = self.__WB_MANIFEST || [];
const manifestEntries = Array.isArray(manifestEntriesRaw) ? manifestEntriesRaw : [];

const toAbsoluteUrl = (url) => new URL(url, self.location.origin).toString();

const precacheUrls = new Set(
  manifestEntries
    .map((entry) => (entry && entry.url ? toAbsoluteUrl(entry.url) : null))
    .filter(Boolean)
);

for (const path of APP_SHELL_PATHS) {
  const absolute = toAbsoluteUrl(path);
  if (!precacheUrls.has(absolute)) {
    precacheUrls.add(absolute);
  }
}

const precacheRequests = Array.from(precacheUrls, (url) => new Request(url, { cache: 'reload' }));
const precachePathSet = new Set(Array.from(precacheUrls, (url) => new URL(url).pathname));

if (typeof self !== 'undefined') {
  self.__SOMMOS_SW_TEST_HOOKS__ = {
    precacheRequests,
    precachePathSet,
    precacheCacheName: PRECACHE_CACHE_NAME,
    runtimeCacheName: RUNTIME_CACHE_NAME,
    staticCacheName: STATIC_CACHE_NAME,
    apiCacheName: API_CACHE_NAME,
    imageCacheName: IMAGE_CACHE_NAME,
    criticalApiCacheName: CRITICAL_API_CACHE_NAME,
    cacheStrategies: CACHE_STRATEGIES,
    criticalApiRoutes: CRITICAL_API_ROUTES
  };
}

const getPrecacheFallback = async (path) => {
  const cache = await caches.open(PRECACHE_CACHE_NAME);
  const absoluteUrl = toAbsoluteUrl(path);
  const cached = await cache.match(absoluteUrl);
  if (cached) {
    return cached;
  }
  return cache.match(path);
};

// Strategic cache handlers
const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return Response.error();
  }
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return offlineApiResponse();
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Start network request in background
  const networkPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // If no cache, wait for network
  return networkPromise || Response.error();
};

// Determine request type and apply appropriate strategy
const getRequestType = (url) => {
  const pathname = new URL(url).pathname;
  
  if (CRITICAL_API_ROUTES.includes(pathname)) {
    return 'CRITICAL_API';
  }
  
  if (pathname.startsWith('/api/')) {
    return 'API';
  }
  
  if (pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    return 'IMAGES';
  }
  
  if (pathname.startsWith('/assets/') || 
      pathname.startsWith('/icons/') || 
      pathname.match(/\.(js|css|woff|woff2|ttf|eot)$/i)) {
    return 'STATIC';
  }
  
  return 'STATIC'; // Default to static for other resources
};

const getCacheName = (requestType) => {
  switch (requestType) {
    case 'CRITICAL_API': return CRITICAL_API_CACHE_NAME;
    case 'API': return API_CACHE_NAME;
    case 'IMAGES': return IMAGE_CACHE_NAME;
    case 'STATIC': return STATIC_CACHE_NAME;
    default: return STATIC_CACHE_NAME;
  }
};

const applyCacheStrategy = async (request, requestType) => {
  const cacheName = getCacheName(requestType);
  
  switch (requestType) {
    case 'CRITICAL_API':
      // For critical API routes, use cache-first with background refresh
      return cacheFirst(request, cacheName);
    case 'API':
      return networkFirst(request, cacheName);
    case 'IMAGES':
      return staleWhileRevalidate(request, cacheName);
    case 'STATIC':
    default:
      return cacheFirst(request, cacheName);
  }
};

// Pre-cache critical API data
const precacheCriticalApiData = async () => {
  const criticalApiCache = await caches.open(CRITICAL_API_CACHE_NAME);
  
  for (const route of CRITICAL_API_ROUTES) {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await criticalApiCache.put(route, response.clone());
        console.log(`Pre-cached critical API route: ${route}`);
      }
    } catch (error) {
      console.warn(`Failed to pre-cache API route ${route}:`, error);
    }
  }
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE_NAME);
      await cache.addAll(precacheRequests);
      
      // Pre-cache critical API data
      await precacheCriticalApiData();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const validCacheNames = [
        PRECACHE_CACHE_NAME,
        RUNTIME_CACHE_NAME,
        STATIC_CACHE_NAME,
        API_CACHE_NAME,
        IMAGE_CACHE_NAME,
        CRITICAL_API_CACHE_NAME
      ];
      
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCacheNames.includes(cacheName)) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle sync manager configuration updates
  if (event.data && event.data.type === 'SYNC_CONFIG_UPDATE') {
    // Forward sync configuration to all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_CONFIG_UPDATED',
          config: event.data.config
        });
      });
    });
  }
  
  // Handle critical API refresh requests
  if (event.data && event.data.type === 'REFRESH_CRITICAL_API') {
    event.waitUntil(
      (async () => {
        try {
          console.log('Manual critical API refresh triggered');
          await precacheCriticalApiData();
          
          // Notify the requesting client
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: 'CRITICAL_API_REFRESH_COMPLETE',
              success: true,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('Manual critical API refresh failed:', error);
          
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: 'CRITICAL_API_REFRESH_COMPLETE',
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        }
      })()
    );
  }
});

const offlineApiResponse = () =>
  new Response(
    JSON.stringify({
      success: false,
      error: 'Offline or server unavailable'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            return networkResponse;
          }
        } catch (error) {
          // Ignore network errors and fallback to cache.
        }

        const fallback = await getPrecacheFallback('/index.html');
        if (fallback) {
          return fallback;
        }

        return Response.error();
      })()
    );
    return;
  }

  // Check if request is in precache first
  if (precachePathSet.has(requestUrl.pathname)) {
    event.respondWith(
      (async () => {
        const precache = await caches.open(PRECACHE_CACHE_NAME);
        const cachedPrecache = await precache.match(event.request);
        if (cachedPrecache) {
          return cachedPrecache;
        }
        
        // Fallback to strategic caching for precache items not found
        const requestType = getRequestType(event.request.url);
        return applyCacheStrategy(event.request, requestType);
      })()
    );
    return;
  }

  // Apply strategic caching for all other requests
  event.respondWith(
    (async () => {
      const requestType = getRequestType(event.request.url);
      return applyCacheStrategy(event.request, requestType);
    })()
  );
});

// Background sync support for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      (async () => {
        try {
          // Notify clients that background sync is happening
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'BACKGROUND_SYNC_STARTED',
              timestamp: Date.now()
            });
          });
          
          // The actual sync processing is handled by the SommOSSyncService
          // This event just triggers the sync process
          console.log('Background sync triggered');
        } catch (error) {
          console.error('Background sync failed:', error);
        }
      })()
    );
  }
  
  // Background refresh for critical API data
  if (event.tag === 'critical-api-refresh') {
    event.waitUntil(
      (async () => {
        try {
          console.log('Refreshing critical API data in background');
          await precacheCriticalApiData();
          
          // Notify clients that critical API data was refreshed
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'CRITICAL_API_REFRESHED',
              timestamp: Date.now()
            });
          });
        } catch (error) {
          console.error('Critical API refresh failed:', error);
        }
      })()
    );
  }
});

// Handle push notifications for sync events
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'sync-notification') {
      const options = {
        body: data.message || 'Sync operation completed',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'sync-notification',
        data: data
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'SommOS Sync', options)
      );
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.type === 'sync-notification') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
          clients[0].postMessage({
            type: 'SYNC_NOTIFICATION_CLICKED',
            data: event.notification.data
          });
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});
