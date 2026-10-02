/**
 * Canvas 2D capability probe.
 *
 * The LOKMAT watch runs an AOSP 10 WebView where accelerated canvas paints
 * nothing at all (the DOM/SVG layer renders fine, the canvas layer stays
 * black). Instead of shipping a dead black rectangle we probe once: paint a
 * pixel and read it back. Anything that throws, returns no context, or paints
 * nothing means "no canvas" and every canvas widget swaps to an SVG face.
 */
let cached: boolean | null = null;

const KEY = "apex.canvas.broken";

/**
 * Old WebViews (AOSP 10 watch builds, Chrome < 80) can pass the pixel probe
 * and still tear down the whole page a few seconds later when the compositor
 * runs out of GPU memory — the symptom is "renders, then black page". Those
 * builds get the SVG face permanently; nothing is drawn into a canvas layer.
 */
export function isLegacyWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const m = /Chrome\/(\d+)/.exec(ua);
  const major = m ? Number(m[1]) : 0;
  if (major && major < 80) return true;
  // AOSP stock WebView on Android 10 and below, no Chrome branding.
  const and = /Android (\d+)/.exec(ua);
  if (and && Number(and[1]) <= 10) return true;
  return false;
}

/**
 * A watch-sized viewport gets the stable SVG renderer even when its vendor
 * WebView reports a newer Chrome version. Several AOSP builds spoof that
 * version while still using the older, crash-prone canvas compositor.
 */
let watchLatched: boolean | null = null;

export function isWatchViewport(): boolean {
  if (typeof window === "undefined") return false;
  // Latch once per session. The layout viewport changes when the user flips
  // "Desktop site", rotates, or pinches — and swapping renderers mid-session
  // is what makes the face jump between the simple and the full build.
  if (watchLatched !== null) return watchLatched;
  // Judge the physical panel, not the CSS layout viewport: a phone in desktop
  // mode still has a phone screen, and a watch is a small *square* panel.
  const sw = (window.screen && window.screen.width) || window.innerWidth || 0;
  const sh = (window.screen && window.screen.height) || window.innerHeight || 0;
  const longEdge = Math.max(sw, sh);
  const shortEdge = Math.min(sw, sh);
  const squarish = shortEdge > 0 && longEdge / shortEdge < 1.25;
  const ua = navigator.userAgent || "";
  const android = /Android\s+(\d+)/i.exec(ua);
  const androidMajor = android ? Number(android[1]) : 0;
  const mobileAndroid = /Android|Mobile/i.test(ua);
  // Desktop-site mode can change the CSS viewport and DPR, but it cannot
  // change the physical panel or Android generation. LOKMAT's AOSP 10 browser
  // therefore receives one renderer for the entire document lifetime.
  const legacyWatchPanel =
    mobileAndroid && androidMajor > 0 && androidMajor <= 10 && longEdge <= 720;
  watchLatched = legacyWatchPanel || (longEdge <= 520 && squarish && mobileAndroid);
  document.documentElement.dataset["renderProfile"] = watchLatched ? "watch-static" : "full";
  return watchLatched;
}

export function shouldUseStableSvg(): boolean {
  return isLegacyWebView() || isWatchViewport();
}

export function canvas2dWorks(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return true; // SSR: assume yes, re-probed on client
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1")
      return (cached = false);
  } catch {
    /* storage blocked — fall through to the probe */
  }
  if (shouldUseStableSvg()) return (cached = false);
  try {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) return (cached = false);
    ctx.fillStyle = "#00ff3b";
    ctx.fillRect(0, 0, 8, 8);
    const px = ctx.getImageData(2, 2, 1, 1).data;
    cached = px[3]! > 0 && (px[1]! > 0 || px[0]! > 0);
  } catch {
    cached = false;
  }
  return cached;
}

/** Force the SVG path after a live render error, and remember it next boot. */
export function markCanvasBroken() {
  cached = false;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Drop the memoised probe result so the next `canvas2dWorks()` call re-tests
 * the layer. Used by the ApexFace auto-retry: some watch WebViews only fail
 * the very first paint (layout/compositor not ready yet) and succeed on a
 * fresh canvas a couple of seconds later.
 */
export function resetCanvasProbe(clearStored = false) {
  cached = null;
  if (clearStored) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
