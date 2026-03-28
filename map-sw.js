// map-sw.js — Offline map tile cache for Business OS
// Place this file in the same folder as delivery_confirmation.html

const CACHE = 'osm-tiles-v1';
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
];

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isTile = TILE_HOSTS.some(h => url.hostname === h);
  if (!isTile) return; // only intercept map tiles

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      // Return cached tile if available
      const cached = await cache.match(e.request);
      if (cached) return cached;

      // Fetch fresh tile and cache it
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) cache.put(e.request, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline and not cached — return transparent 1×1 PNG placeholder
        // so map renders without broken tile images
        const placeholder = atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );
        const bytes = Uint8Array.from(placeholder, c => c.charCodeAt(0));
        return new Response(bytes.buffer, {
          headers: { 'Content-Type': 'image/png' },
        });
      }
    })
  );
});
