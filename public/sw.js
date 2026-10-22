// Service worker: lets the app open and show saved hole maps without signal.
// Pages load fresh when online; app files and map pictures come from the
// cache first. Scores and chat never go through here, they use the database.
const APP = 'trip-app-v1';
const TILES = 'trip-tiles-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (![APP, TILES].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(cacheFirst(TILES, req));
  } else if (url.origin === self.location.origin && req.mode === 'navigate') {
    e.respondWith(networkFirst(req));
  } else if (url.origin === self.location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com') && url.pathname.startsWith('/css')) {
    e.respondWith(cacheFirst(APP, req));
  }
});

async function cacheFirst(name, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/', res.clone());
    return res;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}
