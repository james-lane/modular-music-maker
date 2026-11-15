// This file is checked with WebWorker types, separately from the window application.
export {};
declare const self: ServiceWorkerGlobalScope;
declare const PRECACHE_ASSETS: string[];
declare const CACHE_NAME: string;

const assetUrls = new Set(
  PRECACHE_ASSETS.map((asset) => new URL(asset, self.location.origin).href),
);

self.addEventListener('install', (event) => {
  // addAll is atomic: an incomplete download must never replace a working release.
  // Keep the default waiting lifecycle; switching code during a take could lose it.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE_ASSETS.map((asset) => new Request(asset, { cache: 'reload' }))),
      ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Activation only happens after the previous release has no open clients.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('patchwork-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Never cache API responses, recordings, mutations, or third-party traffic.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const home = request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname);
  const cacheKey = home ? new URL('/', self.location.origin).href : request.url;
  if (!assetUrls.has(cacheKey)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(cacheKey)) ?? fetch(request);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PATCHWORK_OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const entries = await Promise.all(PRECACHE_ASSETS.map((asset) => cache.match(asset)));
      event.ports[0].postMessage({ ready: entries.every(Boolean) });
    })(),
  );
});
