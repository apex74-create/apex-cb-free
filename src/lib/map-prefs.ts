import { useCallback, useEffect, useState } from "react";

/**
 * Persisted map state.
 *
 * Layer toggles, overlay opacity and the last zoom survive a reload so the map
 * comes back exactly as it was left — important on the watch, where re-picking
 * four settings through a 400px face after every cold boot is unusable.
 */
export type MapPrefs = {
  basemap: "dark" | "sat" | "osm";
  /** tremor intensity overlay on the breadcrumb trail */
  tremor: boolean;
  /** shield explode-seek chain reaction */
  explode: boolean;
  /** shield IR room depth rings */
  ir: boolean;
  /** overlay opacity, 0..1 */
  opacity: number;
  /** last zoom level */
  zoom: number;
  /** follow-lock on the device fix */
  follow: boolean;
};

export const DEFAULT_PREFS: MapPrefs = {
  basemap: "dark",
  tremor: true,
  explode: true,
  ir: false,
  opacity: 0.75,
  zoom: 17,
  follow: true,
};

const KEY = "apex.map.prefs";
const EVENT = "apex:map-prefs";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function loadPrefs(): MapPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<MapPrefs>;
    const basemap = p.basemap === "sat" || p.basemap === "osm" ? p.basemap : "dark";
    return {
      basemap,
      tremor: p.tremor !== false,
      explode: p.explode !== false,
      ir: !!p.ir,
      opacity: clamp(Number(p.opacity) || DEFAULT_PREFS.opacity, 0.1, 1),
      zoom: clamp(Number(p.zoom) || DEFAULT_PREFS.zoom, 2, 19),
      follow: p.follow !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(next: MapPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage locked — keep the in-memory value */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/**
 * React binding. Starts from the fixed defaults so SSR and the first client
 * render agree, then adopts the stored values in an effect.
 */
export function useMapPrefs() {
  const [prefs, setPrefs] = useState<MapPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
    const handler = (e: Event) => setPrefs((e as CustomEvent<MapPrefs>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const update = useCallback(<K extends keyof MapPrefs>(key: K, value: MapPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update, hydrated };
}
