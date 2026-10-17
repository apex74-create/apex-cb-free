/**
 * Watch-focused render throttling.
 *
 * The LOKMAT face has a fraction of the fill rate of a phone, and a map that
 * tries to composite tiles, vector overlays and an effects canvas at 60fps is
 * exactly what makes it time out and black-page. Every animated map layer runs
 * through this budget instead of a bare requestAnimationFrame loop.
 */
import { isLegacyWebView, isWatchViewport } from "@/lib/canvas-support";

export type ThrottleProfile = {
  name: "watch" | "legacy" | "phone";
  /** target frames per second for the effects layer */
  fps: number;
  /** minimum ms between full vector redraws of the Leaflet overlay */
  redrawMs: number;
  /** skip the effects canvas entirely and use static vector chrome */
  vectorOnly: boolean;
};

export const PROFILES: Record<ThrottleProfile["name"], ThrottleProfile> = {
  watch: { name: "watch", fps: 12, redrawMs: 1200, vectorOnly: true },
  legacy: { name: "legacy", fps: 15, redrawMs: 900, vectorOnly: true },
  phone: { name: "phone", fps: 45, redrawMs: 250, vectorOnly: false },
};

export function detectProfile(): ThrottleProfile {
  if (typeof window === "undefined") return PROFILES.phone;
  if (isWatchViewport()) return PROFILES.watch;
  if (isLegacyWebView()) return PROFILES.legacy;
  return PROFILES.phone;
}

/**
 * rAF loop with a hard frame budget. `fn` receives a dtScale normalised to a
 * 60fps step so animation speed is identical at 12fps and 45fps.
 * Pauses when the document is hidden — a backgrounded watch app that keeps
 * painting is the fastest route to a compositor kill.
 */
export function throttledLoop(fps: number, fn: (now: number, dtScale: number) => void) {
  const budget = 1000 / Math.max(1, fps);
  let raf = 0;
  let last = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (typeof document !== "undefined" && document.hidden) {
      last = now;
      return;
    }
    const elapsed = now - last;
    if (elapsed < budget) return;
    // Clamp so a long stall (tab resume) doesn't teleport every animation.
    const dtScale = Math.min(4, elapsed / (1000 / 60));
    last = now;
    fn(now, dtScale);
  };

  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Trailing-edge throttle for the Leaflet vector redraw pass. */
export function makeRedrawGate(minMs: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    run(fn: () => void) {
      const now = Date.now();
      const wait = minMs - (now - last);
      if (timer) clearTimeout(timer);
      if (wait <= 0) {
        last = now;
        fn();
        return;
      }
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn();
      }, wait);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
