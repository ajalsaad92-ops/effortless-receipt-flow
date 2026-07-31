/**
 * Offline shell for the workshop. Garages have terrible reception, and the
 * reference data (fault codes, PID tables, diagrams) is static — there is no
 * reason any of it should need the network twice.
 *
 * Deliberately conservative: nothing is precached at install, so a bad deploy
 * can never brick the app with a stale hashed asset. Everything is filled in
 * as it is actually used.
 */
const VERSION = "gm-obd-v1";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Hashed build assets are immutable — serve from cache, fall back to network. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Pages: always prefer fresh, but keep the last good copy for offline. */
async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = (await cache.match(request)) ?? (await cache.match("/"));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The AI endpoint streams and costs money — never cache, never replay.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/assets/") || /\.(js|css|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
