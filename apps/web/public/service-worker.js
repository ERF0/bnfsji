const CACHE_NAME = "bnafsaji-static-v1";
const PRECACHE = ["/offline.html", "/offline.css", "/manifest.webmanifest", "/bnafsaji.svg", "/icon-180.png", "/icon-192.png", "/icon-512.png"];
const STATIC_FILES = new Set(PRECACHE.slice(1));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("bnafsaji-static-") && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

function isStaticAsset(pathname) {
  return STATIC_FILES.has(pathname);
}

async function cacheStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type !== "opaque") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()));
    return;
  }

  if (isStaticAsset(url.pathname)) event.respondWith(cacheStaticAsset(request));
});
