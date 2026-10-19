const CACHE = "cifi-planner-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function wantsFresh(request) {
  if (request.method !== "GET") return false;
  if (request.mode === "navigate") return true;
  const path = new URL(request.url).pathname;
  return path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".html");
}

self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (!wantsFresh(event.request)) return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    if (fresh && fresh.ok) {
      try {
        await cache.put(request, fresh.clone());
      } catch (err) {}
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
