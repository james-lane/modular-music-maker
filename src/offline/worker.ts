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
  // Wait by default; only the idle studio's explicit update action may activate early.
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
      // Ordinary activation follows window closure; an explicit update reloads its sole client.
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

async function completeRelease(): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const entries = await Promise.all(PRECACHE_ASSETS.map((asset) => cache.match(asset)));
  return entries.every(Boolean);
}

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (!event.ports[0]) return;
  if (type === 'PATCHWORK_OFFLINE_STATUS') {
    event.waitUntil(completeRelease().then((ready) => event.ports[0].postMessage({ ready })));
  } else if (type === 'PATCHWORK_APPLY_UPDATE') {
    event.waitUntil(
      (async () => {
        // Do not switch another window's worker underneath an unknown playing/recording session.
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const source = event.source;
        if (!source || !('id' in source) || windows.length !== 1 || windows[0].id !== source.id) {
          event.ports[0].postMessage({ ready: false, reason: 'other-windows' });
          return;
        }
        if (!(await completeRelease())) {
          event.ports[0].postMessage({ ready: false, reason: 'incomplete' });
          return;
        }
        event.ports[0].postMessage({ ready: true });
        await self.skipWaiting();
      })(),
    );
  }
});
