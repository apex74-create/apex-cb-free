import { useEffect } from "react";
import { AWAKE_CLIP_MP4, AWAKE_CLIP_WEBM } from "@/lib/awake-clip";

type Sentinel = {
  release: () => Promise<void>;
  addEventListener: (e: string, f: () => void) => void;
};

/**
 * Keeps the display lit on watch and phone panels.
 *
 * Two independent holds, because the watch panels that need this most are the
 * ones missing the modern API:
 *
 *  1. Screen Wake Lock, re-acquired on visibility, focus, pageshow and touch.
 *  2. A muted looping video, which is what legacy Wear/Android 10 WebViews
 *     actually respect. It runs alongside the lock rather than only as a
 *     fallback: on those panels `navigator.wakeLock` can exist but every
 *     request is refused, so feature-detection alone lets the screen sleep.
 *
 * Autoplay of a muted inline clip is allowed without a gesture, but if the
 * browser still refuses, every touch retries the play.
 */
export default function ScreenAwake() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // ---- hold 2: media keep-alive — only for watch-sized panels or browsers
    // without Wake Lock. On laptops/Chromebooks a full-viewport video under
    // every page is pure GPU/decoder load and was locking machines up.
    const nav0 = navigator as Navigator & { wakeLock?: unknown };
    const small = Math.min(window.screen?.width ?? 9999, window.screen?.height ?? 9999) < 520;
    const useVideo = !nav0.wakeLock || small;
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("loop", "");
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.defaultMuted = true;
    // Full-viewport and faintly visible on purpose: legacy watch WebViews only
    // treat a clip as "playing video" — and so only defer the screen timeout —
    // when it actually occupies visible, composited area. A 1px hidden clip is
    // optimised straight out of the compositor and holds nothing.
    video.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;opacity:0.02;pointer-events:none;z-index:-1;object-fit:cover";
    // Both codecs: some watch builds ship H.264 only, some VP8 only. The
    // browser picks the first source it can decode.
    for (const [src, type] of [
      [AWAKE_CLIP_MP4, "video/mp4"],
      [AWAKE_CLIP_WEBM, "video/webm"],
    ] as const) {
      const s = document.createElement("source");
      s.src = src;
      s.type = type;
      video.appendChild(s);
    }
    if (useVideo) document.body.appendChild(video);
    const play = () => {
      if (!useVideo) return;
      if (document.visibilityState !== "visible") return;
      if (video.paused || video.ended) void video.play().catch(() => {});
    };
    play();

    // ---- hold 1: Screen Wake Lock where it is honoured
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<Sentinel> };
    };
    let sentinel: Sentinel | null = null;
    let dropped = false;

    const acquire = async () => {
      if (dropped || !nav.wakeLock || sentinel) return;
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (dropped) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // Refused while dimming, or unsupported in practice. The video hold
        // carries the panel; the next tick retries.
      }
    };

    // Watchdog: a watch WebView can leave the element "playing" while decoding
    // has actually stalled, which silently drops the hold. If the clock has not
    // moved between ticks, reload and restart it.
    let lastTime = -1;
    let lastReload = 0;
    const kick = () => {
      if (!useVideo) return;
      if (video.paused || video.ended) {
        play();
        return;
      }
      if (video.currentTime === lastTime && Date.now() - lastReload > 30_000) {
        lastReload = Date.now();
        try {
          video.load();
        } catch {
          /* ignore */
        }
        void video.play().catch(() => {});
      }
      lastTime = video.currentTime;
    };

    const revive = () => {
      if (document.visibilityState === "visible") {
        play();
        kick();
        void acquire();
      } else {
        sentinel = null;
        video.pause();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("pageshow", revive);
    window.addEventListener("focus", revive);
    window.addEventListener("pointerdown", revive, { passive: true });
    window.addEventListener("touchstart", revive, { passive: true });
    // Short interval: watch panels dim fast, and a dropped video is silent.
    const retry = window.setInterval(revive, 3000);

    return () => {
      dropped = true;
      window.clearInterval(retry);
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("pageshow", revive);
      window.removeEventListener("focus", revive);
      window.removeEventListener("pointerdown", revive);
      window.removeEventListener("touchstart", revive);
      video.pause();
      video.remove();
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => {});
    };
  }, []);

  return null;
}
