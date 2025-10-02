const PRECACHE_VERSION = 'v1';
const RUNTIME_VERSION = 'v1';
const PRECACHE_CACHE_NAME = `sommos-precache-${PRECACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `sommos-runtime-${RUNTIME_VERSION}`;
const APP_SHELL_PATHS = ['/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE_NAME);
      await cache.addAll(APP_SHELL_PATHS);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== PRECACHE_CACHE_NAME && name !== RUNTIME_CACHE_NAME) {
            return caches.delete(name);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

const offlineApiResponse = () =>
  new Response(
    JSON.stringify({ success: false, error: 'Offline or server unavailable' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(event.request);
          if (net && net.ok) return net;
        } catch {}
        const cache = await caches.open(PRECACHE_CACHE_NAME);
        return (await cache.match('/index.html')) || Response.error();
      })()
    );
    return;
  }

  const isApi = url.pathname.startsWith('/api/');
  event.respondWith(
    (async () => {
      try {
        const net = await fetch(event.request);
        if (net && net.ok && (url.pathname.startsWith('/assets/') || !isApi)) {
          const runtime = await caches.open(RUNTIME_CACHE_NAME);
          await runtime.put(event.request, net.clone());
        }
        return net;
      } catch {
        if (!isApi) {
          const runtime = await caches.open(RUNTIME_CACHE_NAME);
          const cached = await runtime.match(event.request);
          if (cached) return cached;
        }
        if (isApi) return offlineApiResponse();
        return Response.error();
      }
    })()
  );
});


