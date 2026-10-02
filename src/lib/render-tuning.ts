import { useCallback, useEffect, useState } from "react";

/**
 * Face render tuning.
 *
 * The canvas watchdog / retry values used to be hard-coded constants, which
 * meant a slow watch WebView (cold boot, compositor not ready) could only be
 * accommodated by editing code. They now live here, persist in localStorage
 * and start from device-aware defaults.
 */
export type RenderTuning = {
  /** ms to wait for the first painted frame before falling back to SVG. */
  watchdogMs: number;
  /** ms before the first remount retry (multiplied per attempt). */
  backoffMs: number;
  /** exponential factor applied per retry attempt. */
  backoffFactor: number;
  /** how many times a blank canvas is remounted before settling on SVG. */
  maxRetries: number;
};

export const WATCHDOG_RANGE = { min: 500, max: 8000, step: 250 };
export const BACKOFF_RANGE = { min: 250, max: 6000, step: 250 };
export const FACTOR_RANGE = { min: 1, max: 3, step: 0.1 };
export const RETRIES_RANGE = { min: 0, max: 6, step: 1 };

const KEY = "apex.renderTuning";
const EVENT = "apex:render-tuning";

/** Small faces get a longer window: watch WebViews lay out late. */
export function defaultTuning(): RenderTuning {
  const min =
    typeof window === "undefined"
      ? 400
      : Math.min(window.innerWidth || 400, window.innerHeight || 400);
  if (min <= 480) return { watchdogMs: 3500, backoffMs: 1500, backoffFactor: 1.6, maxRetries: 3 };
  return { watchdogMs: 2000, backoffMs: 1000, backoffFactor: 1.5, maxRetries: 2 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function loadTuning(): RenderTuning {
  const d = defaultTuning();
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<RenderTuning>;
    return {
      watchdogMs: clamp(
        Number(p.watchdogMs) || d.watchdogMs,
        WATCHDOG_RANGE.min,
        WATCHDOG_RANGE.max,
      ),
      backoffMs: clamp(Number(p.backoffMs) || d.backoffMs, BACKOFF_RANGE.min, BACKOFF_RANGE.max),
      backoffFactor: clamp(
        Number(p.backoffFactor) || d.backoffFactor,
        FACTOR_RANGE.min,
        FACTOR_RANGE.max,
      ),
      maxRetries: clamp(
        Number.isFinite(Number(p.maxRetries)) ? Number(p.maxRetries) : d.maxRetries,
        RETRIES_RANGE.min,
        RETRIES_RANGE.max,
      ),
    };
  } catch {
    return d;
  }
}

export function saveTuning(next: RenderTuning) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — keep the in-memory value */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function resetTuning(): RenderTuning {
  const d = defaultTuning();
  saveTuning(d);
  return d;
}

export function onTuningChange(fn: (t: RenderTuning) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<RenderTuning>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Delay before retry N (0-based attempt index). */
export function retryDelay(t: RenderTuning, attempt: number) {
  return Math.round(t.backoffMs * Math.pow(t.backoffFactor, attempt));
}

/** React binding: live tuning values plus a persisting updater. */
export function useRenderTuning() {
  // SSR renders with no window, so start from the fixed baseline on both
  // sides of hydration and adopt the device-aware value in the effect.
  const [tuning, setTuning] = useState<RenderTuning>(() => ({
    watchdogMs: 2000,
    backoffMs: 1000,
    backoffFactor: 1.5,
    maxRetries: 2,
  }));
  useEffect(() => {
    setTuning(loadTuning());
    return onTuningChange(setTuning);
  }, []);
  const update = useCallback(<K extends keyof RenderTuning>(key: K, value: RenderTuning[K]) => {
    setTuning((prev) => {
      const next = { ...prev, [key]: value };
      saveTuning(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => setTuning(resetTuning()), []);
  return { tuning, update, reset };
}
