const VERSION = "tinyradr-wave-v6";
const SHELL_CACHE = `${VERSION}-shell`;
const FORECAST_CACHE = `${VERSION}-forecast`;
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: "no-cache" });
          if (!response.ok) throw new Error(`failed to cache ${asset}`);
          await cache.put(asset, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("tinyradr-wave-") && ![SHELL_CACHE, FORECAST_CACHE].includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/public/forecast")) {
    event.respondWith(networkFirst(request, FORECAST_CACHE));
    return;
  }

  // Every other live feed (conditions, astro, server calls) always hits the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Only fingerprinted build files are safe to serve from cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {};
    }
  }
  const title = payload.title ?? "Wave forecast alert";
  const body = payload.body ?? "A new forecast update is ready.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag ?? "wave-forecast",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const next = event.notification.data?.url ?? "/forecast";
  event.waitUntil(clients.openWindow(next));
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cacheKey = request.mode === "navigate" ? request.url : request;
  try {
    const fresh = await fetch(request);
    cache.put(cacheKey, fresh.clone());
    return fresh;
  } catch {
    if (request.mode === "navigate") {
      return (
        (await cache.match(cacheKey)) ??
        (await cache.match(request)) ??
        (await cache.match("/")) ??
        Response.error()
      );
    }
    const cached = await cache.match(cacheKey);
    return cached ?? Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (shouldCacheAsset(request, fresh)) {
    cache.put(request, fresh.clone());
  }
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached ?? (await fresh) ?? Response.error();
}

function shouldCacheAsset(request, response) {
  if (!response.ok) return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return false;
  return (
    ["script", "style", "image", "font", "manifest"].includes(request.destination) ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.png" ||
    url.pathname.startsWith("/icons/")
  );
}
