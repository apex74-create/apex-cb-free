/**
 * Dynamic face metrics.
 *
 * Nothing in the UI may assume a 400x400 face. This module measures the real
 * viewport at boot (and on every resize / rotation / WebView late-layout pass)
 * and publishes it as CSS variables, so a 320, 360, 400, 454 or 466 px face all
 * get the same layout at proportional size.
 *
 * Published on <html>:
 *   --face-w / --face-h   measured viewport in px
 *   --face-min            shorter edge in px (the "face size")
 *   --face-auto           auto scale factor, 1 at the 400px reference face
 *   --ui-scale            --face-auto multiplied by the user's watch scale
 *   data-face-size        micro | watch | phone | large  (styling hook)
 *
 * Deliberately written with plain ES5-safe DOM calls: the target device runs an
 * AOSP 10 stock WebView, so no ResizeObserver / matchMedia dependency here.
 */

/** Reference face the visual design was authored against. */
export const REFERENCE_FACE = 400;

export type FaceMetrics = {
  w: number;
  h: number;
  min: number;
  auto: number;
  bucket: "micro" | "watch" | "phone" | "large";
};

function bucketFor(min: number): FaceMetrics["bucket"] {
  if (min <= 340) return "micro";
  if (min <= 480) return "watch";
  if (min <= 820) return "phone";
  return "large";
}

export function measureFace(): FaceMetrics {
  // The LOKMAT WebView changes visualViewport while its browser chrome settles
  // and when the page's root scale is applied. Feeding those changing values
  // back into `zoom` creates a resize loop that can drop the compositor a
  // second or two after first paint. A small square panel has one stable truth:
  // its physical CSS screen size. Use that for the entire watch session, just
  // as the vector-only tremor map does.
  const screenW = typeof window !== "undefined" ? window.screen?.width || 0 : 0;
  const screenH = typeof window !== "undefined" ? window.screen?.height || 0 : 0;
  const screenLong = Math.max(screenW, screenH);
  const screenShort = Math.min(screenW, screenH);
  const stableWatch = screenShort > 0 && screenLong <= 520 && screenLong / screenShort < 1.25;
  // The visual viewport is never consulted: it moves during pinch, keyboard
  // and WebView chrome settling, and every read fed a re-scale that killed the
  // paint on the watch. Layout size only.
  const use = null as { width: number; height: number } | null;
  const w = Math.max(
    1,
    Math.round(
      (stableWatch ? screenW : 0) ||
        (use && use.width) ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        0,
    ),
  );
  const h = Math.max(
    1,
    Math.round(
      (stableWatch ? screenH : 0) ||
        (use && use.height) ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0,
    ),
  );
  const min = Math.min(w, h);
  // Scale linearly with the face below the reference size, and only mildly
  // above it so a phone or Chromebook does not get comically large glyphs.
  const raw = min <= REFERENCE_FACE ? min / REFERENCE_FACE : 1 + (min / REFERENCE_FACE - 1) * 0.25;
  const auto = Math.max(0.72, Math.min(1.35, Math.round(raw * 1000) / 1000));
  return { w, h, min, auto, bucket: bucketFor(min) };
}

/** Read the user's own scale so auto-scale multiplies instead of replacing it. */
function userScale(root: HTMLElement): number {
  const v = parseFloat(root.style.getPropertyValue("--watch-scale") || "1");
  return isFinite(v) && v > 0 ? v : 1;
}

/** Form factor from the measured viewport. Same buckets the diagnostics use. */
export function deviceFor(w: number, h: number): "watch" | "phone" | "tablet" | "desktop" {
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  if (max <= 480 && min <= 480) return "watch";
  if (max <= 900) return "phone";
  if (max <= 1280) return "tablet";
  return "desktop";
}

export function applyFaceMetrics(m: FaceMetrics = measureFace()): FaceMetrics {
  if (typeof document === "undefined") return m;
  const root = document.documentElement;
  root.style.setProperty("--face-w", m.w + "px");
  root.style.setProperty("--face-h", m.h + "px");
  root.style.setProperty("--face-min", m.min + "px");
  root.style.setProperty("--app-h", m.h + "px");
  root.style.setProperty("--face-auto", String(m.auto));
  root.style.setProperty("--ui-scale", String(Math.round(m.auto * userScale(root) * 1000) / 1000));
  root.setAttribute("data-face-size", m.bucket);
  // Form-factor hook. The stylesheet already specialises on data-device;
  // publishing it here is what makes one build lay itself out correctly on a
  // watch, a phone, a tablet and a desktop without separate code paths.
  root.setAttribute("data-device", deviceFor(m.w, m.h));
  return m;
}

/**
 * Keeps the metrics live. Returns a teardown function.
 * The delayed re-measures cover watch WebViews that report a stale or zero
 * viewport for the first few hundred ms after load.
 */
export function watchFaceMetrics(onChange?: (m: FaceMetrics) => void) {
  if (typeof window === "undefined") return () => {};
  let last = "";
  const run = () => {
    const m = applyFaceMetrics();
    const key = m.w + "x" + m.h;
    if (key !== last) {
      last = key;
      if (onChange) onChange(m);
    }
  };
  // Coalesce bursts (pinch, keyboard, WebView late layout) into one pass per
  // frame so a gesture cannot trigger dozens of full-page re-scales.
  let pending = 0;
  const schedule = () => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      run();
    }, 100);
  };
  run();
  const sw = window.screen?.width || 0;
  const sh = window.screen?.height || 0;
  const longEdge = Math.max(sw, sh);
  const shortEdge = Math.min(sw, sh);
  const fixedSquareWatch = shortEdge > 0 && longEdge <= 520 && longEdge / shortEdge < 1.25;
  // A square watch panel does not need late layout retries. Avoiding them is
  // important: each retry previously rewrote root zoom/height after paint.
  const timers = fixedSquareWatch ? [] : [60, 250, 800, 2000].map((d) => window.setTimeout(run, d));
  if (fixedSquareWatch) {
    return () => {
      if (pending) window.clearTimeout(pending);
    };
  }
  // Only real layout changes (rotation / window resize) re-measure. The visual
  // viewport is deliberately ignored so pinch or keyboard cannot rewrite the
  // root sizing after first paint.
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  return () => {
    timers.forEach((t) => window.clearTimeout(t));
    if (pending) window.clearTimeout(pending);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
  };
}

/** Apply the physical watch contract once, before any responsive listeners. */
export function lockWatchFaceMetrics(): FaceMetrics | null {
  if (typeof window === "undefined") return null;
  const sw = window.screen?.width || 0;
  const sh = window.screen?.height || 0;
  const longEdge = Math.max(sw, sh);
  const shortEdge = Math.min(sw, sh);
  const ua = navigator.userAgent || "";
  const android = /Android\s+(\d+)/i.exec(ua);
  const androidMajor = android ? Number(android[1]) : 0;
  const mobileAndroid = /Android|Mobile/i.test(ua);
  const watch =
    (shortEdge > 0 && longEdge <= 520 && longEdge / shortEdge < 1.25 && mobileAndroid) ||
    (mobileAndroid && androidMajor > 0 && androidMajor <= 10 && longEdge <= 720);
  if (!watch) return null;
  const m = measureFace();
  applyFaceMetrics(m);
  document.documentElement.dataset["renderProfile"] = "watch-static";
  document.documentElement.dataset["device"] = "watch";
  return m;
}
