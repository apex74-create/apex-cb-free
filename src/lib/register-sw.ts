/** Single registration point for the generated, published-only offline worker. */
const SW_URL = "/sw.js";
let started = false;

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  const preview =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host === "lovableproject.com" ||
      host.endsWith(".lovableproject.com") ||
      host === "lovableproject-dev.com" ||
      host.endsWith(".lovableproject-dev.com") ||
      host === "beta.lovable.dev" ||
      host.endsWith(".beta.lovable.dev") ||
      new URLSearchParams(window.location.search).get("sw") === "off");
  if (!import.meta.env.PROD || preview) {
    await cleanupServiceWorkers();
    return null;
  }
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost"
  ) {
    // Non-secure origins cannot host a worker; fail quietly.
    return null;
  }
  if (started) return navigator.serviceWorker.getRegistration("/");
  started = true;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
    const check = () => {
      if (navigator.onLine) void reg.update().catch(() => undefined);
    };
    check();
    window.addEventListener("online", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshed = false;
    let pendingRefresh = false;
    document.addEventListener("visibilitychange", () => {
      if (pendingRefresh && document.visibilityState === "visible") window.location.reload();
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !refreshed && navigator.onLine) {
        refreshed = true;
        if (document.visibilityState === "visible") window.location.reload();
        else pendingRefresh = true;
      }
    });
    return reg;
  } catch {
    started = false;
    return null;
  }
}

/** Remove app-shell workers in preview without deleting regional map tiles. */
export async function cleanupServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.allSettled(
        names
          .filter((n) => n.startsWith("apex-pages-") || n.startsWith("apex-build-assets-") || n.startsWith("workbox-precache-") || n.startsWith("tinyradr-wave-"))
          .map((n) => caches.delete(n)),
      );
    }
  } catch {
    /* nothing to clean up */
  }
}
