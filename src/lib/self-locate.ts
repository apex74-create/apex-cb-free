/**
 * Self-location handoff: Super Bumbershoot → map.
 *
 * The denied-mode solver works in a local metre frame (see engines/denied.ts).
 * The map needs globe coordinates. This module projects the relative fix onto
 * the latched frame origin — a real coarse seed (browser fix, manual entry,
 * noon sight, or the last confirmed GPS fix) — so that once the bumbershoot
 * closes, the map self-locates instead of sitting on the world view.
 *
 * Nothing is invented: with no origin there is no self-location, and the fix
 * carries the solver's own sigma and confidence so the map can draw the real
 * uncertainty ring.
 */

import { getSeed } from "./geo-seed";
import type { RelFix } from "./engines/denied";

export type SelfFix = {
  lat: number;
  lon: number;
  /** 1-sigma radius in metres, straight from the denied solve */
  sigma: number;
  confidence: number;
  anchors: number;
  source: RelFix["source"];
  ts: number;
};

const KEY = "apex.self.fix";
const LAST_GPS_KEY = "apex.map.lastfix";
/** A self-location older than this is stale — the wearer has moved on. */
export const SELF_FIX_TTL_MS = 5 * 60 * 1000;

let current: SelfFix | null = null;
let loaded = false;
const subs = new Set<() => void>();

const METRES_PER_DEG = 111_320;

/** Frame origin: the coarse seed first, else the last confirmed GPS fix. */
export function frameOrigin(): { lat: number; lon: number } | null {
  const seed = getSeed();
  if (seed) return { lat: seed.lat, lon: seed.lon };
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_GPS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { lat: number; lon: number };
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lon) ? { lat: v.lat, lon: v.lon } : null;
  } catch {
    return null;
  }
}

/** Local metre offsets → globe coordinates about the origin. */
export function project(
  origin: { lat: number; lon: number },
  east: number,
  north: number,
): { lat: number; lon: number } {
  const lat = origin.lat + north / METRES_PER_DEG;
  const lonScale = Math.max(1e-6, Math.cos((origin.lat * Math.PI) / 180));
  const lon = origin.lon + east / (METRES_PER_DEG * lonScale);
  return { lat, lon };
}

export function getSelfFix(): SelfFix | null {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  if (current && Date.now() - current.ts > SELF_FIX_TTL_MS) return null;
  return current;
}

/**
 * Publish a bumbershoot solve. Returns the projected fix, or null when there
 * is no origin to project it onto (relative-only — the map stays put).
 */
export function publishSelfFix(rel: RelFix | null, at = Date.now()): SelfFix | null {
  if (!rel) return getSelfFix();
  const origin = frameOrigin();
  if (!origin) return getSelfFix();

  const { lat, lon } = project(origin, rel.x, rel.y);
  const next: SelfFix = {
    lat,
    lon,
    sigma: rel.sigma,
    confidence: rel.confidence,
    anchors: rel.anchors,
    source: rel.source,
    ts: at,
  };
  loaded = true;
  current = next;
  for (const fn of subs) fn();
  return next;
}

export function clearSelfFix() {
  loaded = true;
  current = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const fn of subs) fn();
}

export function subscribeSelfFix(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
