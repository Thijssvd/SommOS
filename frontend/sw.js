const PRECACHE_VERSION = 'v2';
const RUNTIME_VERSION = 'v2';
const PRECACHE_CACHE_NAME = `sommos-precache-${PRECACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `sommos-runtime-${RUNTIME_VERSION}`;
const CACHEABLE_API_PATHS = new Set(['/api/system/health']);
const APP_SHELL_PATHS = ['/index.html', '/test-pairing.html', '/manifest.json'];

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
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== PRECACHE_CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME) {
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

  event.respondWith(
    (async () => {
      const precache = await caches.open(PRECACHE_CACHE_NAME);
      const cachedPrecache = await precache.match(event.request);
      if (cachedPrecache) {
        return cachedPrecache;
      }

      const isApiRequest = requestUrl.pathname.startsWith('/api/');
      const shouldRuntimeCache =
        precachePathSet.has(requestUrl.pathname) ||
        requestUrl.pathname.startsWith('/assets/') ||
        requestUrl.pathname.startsWith('/icons/') ||
        (!isApiRequest || CACHEABLE_API_PATHS.has(requestUrl.pathname));

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok && shouldRuntimeCache) {
          const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
          await runtimeCache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (shouldRuntimeCache) {
          const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
          const cachedRuntime = await runtimeCache.match(event.request);
          if (cachedRuntime) {
            return cachedRuntime;
          }
        }

        if (isApiRequest) {
          return offlineApiResponse();
        }

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
