/**
 * GPS smoothing for a wrist-worn device.
 *
 * Watch GNSS chips report noisy, accuracy-varying fixes: markers jump several
 * metres while you stand still, and a single bad fix can throw the map across
 * the street. Three stages tame that without inventing movement:
 *
 *  1. Gate    — drop fixes with hopeless accuracy or an implausible implied
 *               speed (teleports), and stale duplicates.
 *  2. Kalman  — accuracy-weighted 1-D constant-position filter per axis
 *               (Stochastic / "Android best practice" formulation). A precise
 *               fix pulls hard, a vague one barely moves the estimate.
 *  3. Deadband— below the estimated error, hold the marker still so it does
 *               not shimmer when you are stationary.
 */

export type RawFix = { lat: number; lon: number; acc: number; at: number };
export type SmoothFix = RawFix & { raw: RawFix; moving: boolean };

export type GpsFilterOptions = {
  /** Discard fixes worse than this (metres). */
  maxAccuracy: number;
  /** Discard fixes implying more than this ground speed (m/s). ~45 km/h walk+vehicle mix. */
  maxSpeed: number;
  /** Process noise: how quickly the filter trusts new movement (m/s). */
  processNoise: number;
  /** Hold the marker still while movement is under this fraction of the error. */
  deadbandFactor: number;
};

export const DEFAULT_GPS_OPTIONS: GpsFilterOptions = {
  maxAccuracy: 100,
  maxSpeed: 60,
  processNoise: 1.2,
  deadbandFactor: 0.6,
};

const EARTH_R = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GpsFilter = {
  /** Feed a raw fix. Returns the smoothed fix, or null when the fix was rejected. */
  push: (fix: RawFix) => SmoothFix | null;
  /** Last accepted smoothed fix. */
  current: () => SmoothFix | null;
  /** Number of fixes rejected as noise since the last reset. */
  rejected: () => number;
  reset: () => void;
};

export function createGpsFilter(options: Partial<GpsFilterOptions> = {}): GpsFilter {
  const opts = { ...DEFAULT_GPS_OPTIONS, ...options };

  let lat = 0;
  let lon = 0;
  let variance = -1; // <0 means uninitialised
  let lastAt = 0;
  let out: SmoothFix | null = null;
  let rejected = 0;

  const reset = () => {
    variance = -1;
    lastAt = 0;
    out = null;
    rejected = 0;
  };

  const push = (fix: RawFix): SmoothFix | null => {
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return null;
    const acc = Math.max(1, Number.isFinite(fix.acc) ? fix.acc : opts.maxAccuracy);

    if (acc > opts.maxAccuracy) {
      rejected += 1;
      return out;
    }

    if (variance < 0) {
      lat = fix.lat;
      lon = fix.lon;
      variance = acc * acc;
      lastAt = fix.at;
      out = { lat, lon, acc, at: fix.at, raw: fix, moving: false };
      return out;
    }

    const dt = Math.max(0, (fix.at - lastAt) / 1000);
    if (dt === 0 && out) {
      rejected += 1;
      return out; // duplicate timestamp: nothing new to learn
    }

    // Teleport gate — a jump that would require impossible speed is noise,
    // unless it is also a very precise fix (real re-lock after signal loss).
    const jump = distanceMeters({ lat, lon }, fix);
    const allowed = opts.maxSpeed * Math.max(dt, 1) + acc + Math.sqrt(variance);
    if (jump > allowed && acc > 15) {
      rejected += 1;
      return out;
    }

    // Predict: uncertainty grows with elapsed time.
    variance += dt * opts.processNoise * opts.processNoise;

    // Update: accuracy-weighted gain.
    const k = variance / (variance + acc * acc);
    const nextLat = lat + k * (fix.lat - lat);
    const nextLon = lon + k * (fix.lon - lon);
    variance = (1 - k) * variance;
    lastAt = fix.at;

    const estError = Math.sqrt(variance);
    const step = distanceMeters({ lat, lon }, { lat: nextLat, lon: nextLon });
    const moving = step > estError * opts.deadbandFactor;

    // Deadband: while stationary keep the marker pinned instead of shimmering.
    if (moving) {
      lat = nextLat;
      lon = nextLon;
    }

    out = { lat, lon, acc: Math.max(estError, 1), at: fix.at, raw: fix, moving };
    return out;
  };

  return { push, current: () => out, rejected: () => rejected, reset };
}
