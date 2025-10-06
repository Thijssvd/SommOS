const PRECACHE_VERSION = 'v3';
const RUNTIME_VERSION = 'v3';
const IMAGE_CACHE_VERSION = 'v1';
const PRECACHE_CACHE_NAME = `sommos-precache-${PRECACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `sommos-runtime-${RUNTIME_VERSION}`;
const IMAGE_CACHE_NAME = `sommos-images-${IMAGE_CACHE_VERSION}`;
const CACHEABLE_API_PATHS = new Set([
    '/api/system/health',
    '/api/wines',
    '/api/inventory',
    '/api/vintages'
]);
const STALE_WHILE_REVALIDATE_PATHS = new Set([
    '/api/dashboard/stats',
    '/api/system/metrics'
]);
const APP_SHELL_PATHS = ['/index.html', '/test-pairing.html', '/manifest.json'];
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const NETWORK_TIMEOUT = 5000; // 5 seconds

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
    runtimeCacheName: RUNTIME_CACHE_NAME
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

// Clean expired cache entries based on max age
const cleanExpiredCacheEntries = async (cacheName) => {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const now = Date.now();
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const responseTime = new Date(dateHeader).getTime();
        if (now - responseTime > CACHE_MAX_AGE) {
          await cache.delete(request);
          console.log('[SW] Expired cache entry deleted:', request.url);
        }
      }
    }
  }
};

// Stale-while-revalidate strategy
const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
};

// Network-first with cache fallback and timeout
const networkFirstWithTimeout = async (request, cacheName) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network failed or timeout - fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Network failed, using cache:', request.url);
      return cachedResponse;
    }
    throw error;
  }
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE_NAME);
      await cache.addAll(precacheRequests);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const validCaches = new Set([PRECACHE_CACHE_NAME, RUNTIME_CACHE_NAME, IMAGE_CACHE_NAME]);
      
      // Delete old caches
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.has(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
      
      // Clean expired entries from runtime cache
      await cleanExpiredCacheEntries(RUNTIME_CACHE_NAME);
      
      await self.clients.claim();
      console.log('[SW] Service worker activated and claimed clients');
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle queue sync request
  if (event.data && event.data.type === 'QUEUE_SYNC') {
    event.waitUntil(
      self.registration.sync.register('sync-queue')
        .then(() => {
          console.log('[SW] Background sync registered');
        })
        .catch((error) => {
          console.error('[SW] Background sync registration failed:', error);
        })
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

  // Handle regular requests with intelligent caching strategies
  event.respondWith(
    (async () => {
      const requestUrl = new URL(event.request.url);
      const isApiRequest = requestUrl.pathname.startsWith('/api/');
      
      // Check precache first
      const precache = await caches.open(PRECACHE_CACHE_NAME);
      const cachedPrecache = await precache.match(event.request);
      if (cachedPrecache) {
        return cachedPrecache;
      }

      // Determine caching strategy based on request type
      if (isApiRequest) {
        // Stale-while-revalidate for dashboard/metrics
        if (STALE_WHILE_REVALIDATE_PATHS.has(requestUrl.pathname)) {
          return await staleWhileRevalidate(event.request, RUNTIME_CACHE_NAME);
        }
        
        // Cacheable APIs with network-first + timeout
        if (CACHEABLE_API_PATHS.has(requestUrl.pathname)) {
          try {
            return await networkFirstWithTimeout(event.request, RUNTIME_CACHE_NAME);
          } catch (error) {
            return offlineApiResponse();
          }
        }
        
        // Non-cacheable APIs - network only with offline fallback
        try {
          return await fetch(event.request);
        } catch (error) {
          return offlineApiResponse();
        }
      }

      // Handle images with separate cache
      if (requestUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        const imageCache = await caches.open(IMAGE_CACHE_NAME);
        const cachedImage = await imageCache.match(event.request);
        if (cachedImage) {
          return cachedImage;
        }
        
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            await imageCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return Response.error();
        }
      }

      // Handle static assets (CSS, JS, fonts)
      if (requestUrl.pathname.startsWith('/assets/')) {
        const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
        const cachedAsset = await runtimeCache.match(event.request);
        if (cachedAsset) {
          return cachedAsset;
        }
        
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            await runtimeCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return Response.error();
        }
      }

      // Fallback to network for everything else
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
          await runtimeCache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (requestUrl.pathname.endsWith('.html')) {
          const fallback = await getPrecacheFallback(requestUrl.pathname);
          if (fallback) {
            return fallback;
          }
        }
        return Response.error();
      }
    })()
  );
});

// Background Sync Event Handler
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event triggered:', event.tag);
  
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      (async () => {
        try {
          // Open IndexedDB to get queued operations
          const db = await openSyncDatabase();
          const queue = await getQueuedOperations(db);
          
          if (queue.length === 0) {
            console.log('[SW] No queued operations to sync');
            return;
          }
          
          console.log(`[SW] Processing ${queue.length} queued operations`);
          
          const results = [];
          for (const operation of queue) {
            try {
              // Replay the operation
              const response = await fetch(operation.url, {
                method: operation.method,
                headers: operation.headers,
                body: operation.body
              });
              
              if (response.ok) {
                results.push({ id: operation.id, status: 'success' });
                await removeFromQueue(db, operation.id);
                console.log('[SW] Successfully synced operation:', operation.id);
              } else {
                results.push({ id: operation.id, status: 'failed', error: response.statusText });
                console.warn('[SW] Failed to sync operation:', operation.id, response.statusText);
              }
            } catch (error) {
              results.push({ id: operation.id, status: 'error', error: error.message });
              console.error('[SW] Error syncing operation:', operation.id, error);
            }
          }
          
          // Notify the client about sync results
          const clients = await self.clients.matchAll();
          for (const client of clients) {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              results
            });
          }
          
        } catch (error) {
          console.error('[SW] Sync handler error:', error);
        }
      })()
    );
  }
});

// IndexedDB helpers for Background Sync queue
const openSyncDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sommos-sync-queue', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('operations')) {
        db.createObjectStore('operations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const getQueuedOperations = (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readonly');
    const store = transaction.objectStore('operations');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const removeFromQueue = (db, id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
