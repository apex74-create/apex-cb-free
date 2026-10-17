/**
 * Client-side collection of everything a watch panel can tell us about how it
 * is rendering. No permissions are requested and nothing identifying is read:
 * only panel geometry, engine support and sleep-related capabilities.
 */

export type DeviceProfile = {
  ua: string;
  screen: { w: number; h: number; availW: number; availH: number; dpr: number };
  viewport: { innerW: number; innerH: number; clientW: number; clientH: number; visualH: number };
  appHeight: string;
  deviceBucket: string;
  faceBucket: string;
  orientation: string;
  standalone: boolean;
  colorDepth: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  wakeLockSupported: boolean;
  webglSupported: boolean;
  canvas2dSupported: boolean;
  supportsDvh: boolean;
  supportsBackdrop: boolean;
  reducedMotion: boolean;
  online: boolean;
  connection: string | null;
  serviceWorker: "controlled" | "registered" | "unsupported" | "none";
  language: string;
  timeZone: string;
  androidVersion: number | null;
  chromeVersion: number | null;
  webviewLike: boolean;
  batterySaverHint: boolean;
};

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

export function collectDeviceProfile(): DeviceProfile {
  const root = document.documentElement;
  const ua = navigator.userAgent || "";
  const android = /Android\s+(\d+)/i.exec(ua);
  const chrome = /Chrome\/(\d+)/i.exec(ua);

  let webgl = false;
  let canvas2d = false;
  try {
    const c = document.createElement("canvas");
    canvas2d = !!c.getContext("2d");
    webgl = !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    /* blocked */
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string };
    wakeLock?: unknown;
  };

  return {
    ua,
    screen: {
      w: screen.width,
      h: screen.height,
      availW: screen.availWidth,
      availH: screen.availHeight,
      dpr: window.devicePixelRatio || 1,
    },
    viewport: {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clientW: root.clientWidth,
      clientH: root.clientHeight,
      visualH: Math.round(window.visualViewport?.height ?? 0),
    },
    appHeight: getComputedStyle(root).getPropertyValue("--app-h").trim() || "unset",
    deviceBucket: root.getAttribute("data-device") || "unknown",
    faceBucket: root.getAttribute("data-face-size") || "unknown",
    orientation: screen.orientation?.type || (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    colorDepth: screen.colorDepth,
    hardwareConcurrency: num(navigator.hardwareConcurrency),
    deviceMemory: num(nav.deviceMemory),
    wakeLockSupported: !!nav.wakeLock,
    webglSupported: webgl,
    canvas2dSupported: canvas2d,
    supportsDvh: CSS.supports?.("height", "100dvh") ?? false,
    supportsBackdrop: CSS.supports?.("backdrop-filter", "blur(2px)") ?? false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    online: navigator.onLine,
    connection: nav.connection?.effectiveType ?? null,
    serviceWorker: !("serviceWorker" in navigator)
      ? "unsupported"
      : navigator.serviceWorker.controller
        ? "controlled"
        : "registered",
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    androidVersion: android?.[1] ? parseInt(android[1], 10) : null,
    chromeVersion: chrome?.[1] ? parseInt(chrome[1], 10) : null,
    webviewLike: /\bwv\b/.test(ua) || /Version\/\d+\.\d+ Chrome/.test(ua),
    batterySaverHint: window.matchMedia("(prefers-reduced-data: reduce)").matches,
  };
}

export const SYMPTOMS = [
  { id: "paints-then-black", label: "Paints, then goes black" },
  { id: "never-paints", label: "Never paints — black from the start" },
  { id: "wrong-size", label: "Paints into a corner or off the edge" },
  { id: "blanks-on-nav", label: "Blanks when moving between pages" },
  { id: "freezes", label: "Paints but buttons do nothing" },
  { id: "paints-and-stays", label: "Paints and stays (working reference)" },
] as const;

/** Shrink a photo or frame so it can travel with the report. */
export async function downscaleImage(file: File, max = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This device cannot prepare the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.7);
}
