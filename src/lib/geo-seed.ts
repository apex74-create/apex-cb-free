/**
 * Shared coarse position seed.
 *
 * Solar azimuth needs a latitude/longitude — but only a coarse one: a 50 km
 * error moves the computed sun bearing by well under a degree at mid latitudes.
 * So the seed can come from a browser fix once, from a manual entry, or from a
 * noon-sight latitude estimate. To avoid persisting location history in clear
 * text, the seed is kept in memory only for the current session.
 */

export type Seed = { lat: number; lon: number; ts: number; source: "gps" | "manual" | "noon" };

const KEY = "apex.geo.seed";

let seed: Seed | null = null;
let loaded = false;
const subs = new Set<() => void>();

export function getSeed(): Seed | null {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  return seed;
}

export function setSeed(lat: number, lon: number, source: Seed["source"] = "manual"): Seed | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return getSeed();
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return getSeed();
  loaded = true;
  seed = { lat, lon, ts: Date.now(), source };
  for (const fn of subs) fn();
  return seed;
}

export function clearSeed() {
  loaded = true;
  seed = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const fn of subs) fn();
}

/** One-shot browser fix. Resolves null when denied, unavailable or timed out. */
export function acquireSeed(timeout = 8000): Promise<Seed | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(setSeed(p.coords.latitude, p.coords.longitude, "gps")),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 },
    );
  });
}

export function subscribeSeed(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
