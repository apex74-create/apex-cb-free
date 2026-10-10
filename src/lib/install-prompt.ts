/**
 * Real PWA install plumbing.
 *
 * The `beforeinstallprompt` event fires once, very early — often before React
 * has hydrated. We latch it at module import so the bundle button can fire the
 * browser's real install dialog instead of telling the user to add a bookmark
 * to their home screen by hand.
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

import { recordConfirmedFreeInstall } from "@/lib/free-install-count";

let latched: InstallPromptEvent | null = null;
const listeners = new Set<(e: InstallPromptEvent | null) => void>();

function emit() {
  for (const fn of listeners) fn(latched);
}

if (typeof window !== "undefined") {
  const w = window as unknown as { __apexInstallLatched?: boolean; __apexInstallEvent?: unknown };
  // land.html may have latched it before the SPA bundle loaded.
  if (w.__apexInstallEvent) latched = w.__apexInstallEvent as InstallPromptEvent;
  if (!w.__apexInstallLatched) {
    w.__apexInstallLatched = true;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      latched = e as InstallPromptEvent;
      w.__apexInstallEvent = latched;
      emit();
    });
    window.addEventListener("appinstalled", () => {
      latched = null;
      w.__apexInstallEvent = undefined;
      emit();
      void recordConfirmedFreeInstall();
    });
  }
}

export function getInstallPrompt() {
  return latched;
}

export function onInstallPromptChange(fn: (e: InstallPromptEvent | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fire the browser's real install dialog. Returns the outcome, or null. */
export async function runInstall(): Promise<"accepted" | "dismissed" | null> {
  const e = latched;
  if (!e) return null;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") {
      latched = null;
      emit();
    }
    return outcome;
  } catch {
    return null;
  }
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

/**
 * Watch/WebView browsers cannot install anything. Handing the exact URL to
 * Chrome via an Android intent gets the user to a surface that CAN install the
 * wrapper, which is the closest thing to a one-tap bundle there.
 */
export function chromeIntentUrl(url = typeof window === "undefined" ? "" : window.location.href) {
  const stripped = url.replace(/^https?:\/\//, "");
  return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
