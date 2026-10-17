import { useEffect } from "react";

import { applyLayerShim } from "@/lib/layer-shim";
import { isWatchViewport } from "@/lib/canvas-support";

/**
 * Recovers a device that is stuck on an unstyled shell.
 *
 * Two causes are handled:
 * 1. Legacy WebViews that ignore Tailwind's `@layer` blocks — the layer shim
 *    re-injects the same CSS without layer wrappers.
 * 2. A stale service-worker cache pointing at asset hashes that no longer
 *    exist — wipe caches + workers and reload once with a cache-busting query.
 */
const FLAG = "apex-style-recover";

function stylesApplied() {
  const probe = document.createElement("div");
  probe.className = "text-signal";
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  // Unstyled documents fall back to the inherited/initial text colour.
  return color !== "" && color !== "rgb(0, 0, 0)" && color !== "rgba(0, 0, 0, 0)";
}

export default function StyleGuard() {
  // Legacy watch WebViews drop `dvh` units, which collapses every full-screen
  // route (canvas faces, Leaflet maps) to zero height. Publish a measured
  // pixel height instead so `h-app` always resolves.
  useEffect(() => {
    const setH = () => {
      const h = isWatchViewport()
        ? window.screen?.height || window.innerHeight || 0
        : window.innerHeight || 0;
      if (h > 0) document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`);
    };
    setH();
    // The watch panel is a fixed hardware contract. Rewriting root height after
    // first paint is what made its compositor drop the document to black.
    if (isWatchViewport()) return;
    window.addEventListener("resize", setH);
    window.addEventListener("orientationchange", setH);
    return () => {
      window.removeEventListener("resize", setH);
      window.removeEventListener("orientationchange", setH);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled || stylesApplied()) {
        sessionStorage.removeItem(FLAG);
        return;
      }
      // Legacy browser without cascade layers: re-inject unwrapped CSS.
      if (await applyLayerShim()) {
        if (cancelled || stylesApplied()) return;
      }
      if (sessionStorage.getItem(FLAG) === "done") return; // already tried once
      sessionStorage.setItem(FLAG, "done");

      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(regs.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.allSettled(names.map((n) => caches.delete(n)));
        }
      } catch {
        /* best effort */
      }
      const url = new URL(window.location.href);
      url.searchParams.set("fresh", String(Date.now()));
      window.location.replace(url.toString());
    };
    // Legacy browsers get the layer shim immediately, before any probing.
    void applyLayerShim();
    // Give late-arriving stylesheets a moment before declaring failure.
    const t = window.setTimeout(() => void check(), 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
