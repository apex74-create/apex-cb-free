/**
 * Sky sighting store.
 *
 * The sextant app records real sightings (altitude off the tilt sensor,
 * azimuth off the magnetometer) and the denied-mode trust score on /radar
 * reads them, so a sighting taken in one screen disciplines the local frame
 * everywhere. Plain module state + localStorage; no React, so any screen can
 * subscribe without owning the instrument.
 */

import type { SkySighting } from "./engines/trust";

export type LoggedSighting = SkySighting & {
  /** what the wearer was looking at, free text ("polaris", "moon", …) */
  body: string;
  /** true when the watch was held on its edge in the palm */
  edgeMount: boolean;
  /**
   * degrees to add to a magnetic bearing to get true north, solved from the
   * sun's known azimuth at shot time. Only present on sun-assisted shots.
   */
  trueOffset?: number;
  /** computed solar altitude at shot time, for comparison against the sighted one */
  expectedAltitude?: number;
};

const KEY = "apex.sky.sightings";
const MAX = 12;

let log: LoggedSighting[] = [];
let loaded = false;
const subs = new Set<() => void>();

function load(): LoggedSighting[] {
  if (loaded || typeof window === "undefined") return log;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) log = parsed as LoggedSighting[];
    }
  } catch {
    log = [];
  }
  return log;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* quota or private mode — the in-memory log still works this session */
  }
}

function emit() {
  for (const fn of subs) fn();
}

export function sightings(): LoggedSighting[] {
  return load();
}

/** Most recent sighting, or null when nothing has ever been shot. */
export function latestSighting(): LoggedSighting | null {
  return load()[0] ?? null;
}

/**
 * Newest true-north correction still inside `ttl`. Any screen showing a
 * magnetic bearing can add this to display a true bearing instead.
 */
export function latestCorrection(ttl = 10 * 60 * 1000, at = Date.now()): LoggedSighting | null {
  for (const s of load()) {
    if (typeof s.trueOffset === "number" && at - s.ts < ttl) return s;
  }
  return null;
}

export function recordSighting(s: LoggedSighting): LoggedSighting {
  load();
  log = [s, ...log].slice(0, MAX);
  persist();
  emit();
  return s;
}

export function clearSightings() {
  log = [];
  loaded = true;
  persist();
  emit();
}

export function subscribeSightings(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
