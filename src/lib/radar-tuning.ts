import { useCallback, useEffect, useState } from "react";

/**
 * Radar / channel-scan tuning.
 *
 * Watch panels vary wildly in brightness, and the receive-only channel scan
 * needs different thresholds in a quiet flat than in a block of forty routers.
 * Everything here persists in localStorage and is safe on SSR.
 */
export type RadarTuning = {
  /** 0..1 luminous matrix backdrop intensity (0 = matrix off, cheapest paint). */
  matrix: number;
  /** auto channel scan interval in ms (0 = manual only). */
  scanMs: number;
  /** ignore beacons weaker than this RSSI (dBm). */
  floorDbm: number;
  /** congestion (0..1) above which a channel counts as congested. */
  congestion: number;
  /** peak RSSI above which a lone emitter looks like it is swamping a channel. */
  jamPeakDbm: number;
  /** how many results the history panel keeps. */
  history: number;
};

export const MATRIX_RANGE = { min: 0, max: 1, step: 0.05 };
export const SCANMS_RANGE = { min: 0, max: 300000, step: 5000 };
export const FLOOR_RANGE = { min: -100, max: -40, step: 1 };
export const CONGESTION_RANGE = { min: 0.3, max: 0.95, step: 0.05 };
export const JAMPEAK_RANGE = { min: -70, max: -10, step: 1 };
export const HISTORY_RANGE = { min: 3, max: 40, step: 1 };

const KEY = "apex.radarTuning";
const EVENT = "apex:radar-tuning";

export const DEFAULT_RADAR_TUNING: RadarTuning = {
  matrix: 0.7,
  scanMs: 30000,
  floorDbm: -92,
  congestion: 0.75,
  jamPeakDbm: -35,
  history: 12,
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export function loadRadarTuning(): RadarTuning {
  const d = DEFAULT_RADAR_TUNING;
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<RadarTuning>;
    return {
      matrix: clamp(num(p.matrix, d.matrix), MATRIX_RANGE.min, MATRIX_RANGE.max),
      scanMs: clamp(num(p.scanMs, d.scanMs), SCANMS_RANGE.min, SCANMS_RANGE.max),
      floorDbm: clamp(num(p.floorDbm, d.floorDbm), FLOOR_RANGE.min, FLOOR_RANGE.max),
      congestion: clamp(
        num(p.congestion, d.congestion),
        CONGESTION_RANGE.min,
        CONGESTION_RANGE.max,
      ),
      jamPeakDbm: clamp(num(p.jamPeakDbm, d.jamPeakDbm), JAMPEAK_RANGE.min, JAMPEAK_RANGE.max),
      history: Math.round(clamp(num(p.history, d.history), HISTORY_RANGE.min, HISTORY_RANGE.max)),
    };
  } catch {
    return d;
  }
}

export function saveRadarTuning(next: RadarTuning) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — keep the in-memory value */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function onRadarTuningChange(fn: (t: RadarTuning) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<RadarTuning>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** React binding: live radar tuning plus a persisting updater. */
export function useRadarTuning() {
  const [tuning, setTuning] = useState<RadarTuning>(DEFAULT_RADAR_TUNING);
  useEffect(() => {
    setTuning(loadRadarTuning());
    return onRadarTuningChange(setTuning);
  }, []);
  const update = useCallback(<K extends keyof RadarTuning>(key: K, value: RadarTuning[K]) => {
    setTuning((prev) => {
      const next = { ...prev, [key]: value };
      saveRadarTuning(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    saveRadarTuning(DEFAULT_RADAR_TUNING);
    setTuning(DEFAULT_RADAR_TUNING);
  }, []);
  return { tuning, update, reset };
}
