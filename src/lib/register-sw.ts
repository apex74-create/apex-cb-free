/**
 * Service-worker registration.
 *
 * The worker at /sw.js caches the watch-critical shell (boot page, app shell,
 * hashed build assets) so a cold boot on flaky 4G paints instantly. It is
 * network-first for navigations, so a stale cache can never claim the device
 * is offline while it is online.
 */
const SW_URL = "/sw.js";

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
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
    // Always check for a newer worker on launch so an old cache can't pin the app.
    void reg.update().catch(() => undefined);
    // Take a waiting update straight away — watch sessions are short.
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    reg.addEventListener("updatefound", () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener("statechange", () => {
        if (next.state === "installed" && navigator.serviceWorker.controller) {
          next.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
    return reg;
  } catch {
    return null;
  }
}

/** Drop this worker and caches owned by this app. */
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
          .filter((n) => n.startsWith("apex-") || n.startsWith("tinyradr-wave-"))
          .map((n) => caches.delete(n)),
      );
    }
  } catch {
    /* nothing to clean up */
  }
}
