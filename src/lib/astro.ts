/**
 * Astronomical inputs — the almanac side of the engine.
 *
 * Lunar phase is computed locally from the synodic month, so it needs no feed,
 * no key and no network. Solar forcing arrives with the daily observation
 * arrays; seismic energy arrives from the public quake feed. All three are
 * offered to the engine as ordinary witnesses, never as the answer.
 */

const SYNODIC_DAYS = 29.530588853;
/** A known new moon, UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 86400000;

export type MoonPhase = {
  /** 0 = new, 0.5 = full, 1 = new again */
  phase: number;
  /** fraction of the disc lit, 0..1 */
  illumination: number;
  label: string;
};

const LABELS = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
];

export function moonPhase(iso: string): MoonPhase {
  const t = Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(t)) return { phase: 0, illumination: 0, label: "unknown" };
  const days = (t - NEW_MOON_EPOCH) / DAY_MS;
  const phase = ((days / SYNODIC_DAYS) % 1 + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const idx = Math.round(phase * 8) % 8;
  return {
    phase: Number(phase.toFixed(4)),
    illumination: Number(illumination.toFixed(4)),
    label: LABELS[idx] ?? "unknown",
  };
}

/**
 * The lunar term as a -1..1 series aligned to a list of dates: full moon
 * positive, new moon negative. Almanac tradition, expressed as a wave the
 * synthesis can interfere with at a deliberately small weight.
 */
export function lunarSeries(dates: string[]): Array<number | null> {
  return dates.map((iso) => {
    const m = moonPhase(iso);
    return Number((2 * m.illumination - 1).toFixed(4));
  });
}

/** Pearson correlation over the pairs where both series have a number. */
export function correlate(
  a: Array<number | null>,
  b: Array<number | null>,
): { r: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const x = a[i];
    const y = b[i];
    if (typeof x === "number" && typeof y === "number") {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n < 4) return { r: 0, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a1 = (xs[i] as number) - mx;
    const b1 = (ys[i] as number) - my;
    num += a1 * b1;
    dx += a1 * a1;
    dy += b1 * b1;
  }
  const den = Math.sqrt(dx * dy);
  return { r: den === 0 ? 0 : Number((num / den).toFixed(3)), n };
}

/** Plain-language reading of a correlation coefficient. */
export function correlationLabel(r: number): string {
  const a = Math.abs(r);
  const dir = r >= 0 ? "together" : "opposed";
  if (a < 0.2) return "no relationship";
  if (a < 0.4) return `weak, ${dir}`;
  if (a < 0.65) return `moderate, ${dir}`;
  return `strong, ${dir}`;
}

/* ------------------------------------------------- sun & moon positions */

/**
 * Low-precision topocentric positions, good to a fraction of a degree — more
 * than enough to point at the sky or orient a watch face. Pure arithmetic: no
 * feed, no key, works offline.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export type SkyPosition = {
  /** degrees clockwise from true north, 0..360 */
  azimuth: number;
  /** degrees above the horizon; negative means below */
  altitude: number;
  /** left / right of the observer's facing-south reference */
  side: "east" | "west";
  up: boolean;
};

function julianDays(date: Date): number {
  return date.getTime() / 86400000 - 0.5 + 2440588 - 2451545;
}

function horizontal(
  ra: number,
  dec: number,
  lat: number,
  lon: number,
  d: number,
): SkyPosition {
  // Greenwich mean sidereal time, then the local hour angle.
  const lst = (280.16 + 360.9856235 * d + lon) * RAD;
  const h = lst - ra;
  const phi = lat * RAD;
  const altitude =
    Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)) * DEG;
  let azimuth =
    Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * DEG +
    180;
  azimuth = ((azimuth % 360) + 360) % 360;
  return {
    azimuth: Number(azimuth.toFixed(1)),
    altitude: Number(altitude.toFixed(1)),
    side: azimuth < 180 ? "east" : "west",
    up: altitude > 0,
  };
}

export function sunPosition(date: Date, lat: number, lon: number): SkyPosition {
  const d = julianDays(date);
  const m = (357.5291 + 0.98560028 * d) * RAD;
  const l =
    (280.147 + 0.98564736 * d) * RAD +
    (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) * RAD;
  const e = 23.4397 * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l));
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  return horizontal(ra, dec, lat, lon, d);
}

export function moonPosition(date: Date, lat: number, lon: number): SkyPosition {
  const d = julianDays(date);
  const eclipticLon = (218.316 + 13.176396 * d) * RAD;
  const meanAnomaly = (134.963 + 13.064993 * d) * RAD;
  const meanDistance = (93.272 + 13.22935 * d) * RAD;
  const lambda = eclipticLon + 6.289 * RAD * Math.sin(meanAnomaly);
  const beta = 5.128 * RAD * Math.sin(meanDistance);
  const e = 23.4397 * RAD;
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(e) - Math.tan(beta) * Math.sin(e),
    Math.cos(lambda),
  );
  const dec = Math.asin(Math.sin(beta) * Math.cos(e) + Math.cos(beta) * Math.sin(e) * Math.sin(lambda));
  return horizontal(ra, dec, lat, lon, d);
}

/** Compass point for an azimuth, e.g. 247 -> "WSW". */
export function compassPoint(azimuth: number): string {
  const points = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return points[Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16] ?? "N";
}
