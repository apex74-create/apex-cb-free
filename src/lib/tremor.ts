/**
 * Tremor / ball-signal intensity model.
 *
 * The tremor overlay grades each breadcrumb hop by how much *unexplained*
 * motion it carries. Everything here is computed from real `watchPosition`
 * samples — position, timestamp and reported accuracy — so an intensity value
 * always traces back to a measurement, never to a generator.
 *
 * For two consecutive fixes a -> b:
 *
 *   dt   = (b.at - a.at) / 1000                       seconds
 *   d    = great-circle distance(a, b)                metres
 *   v    = d / dt                                     m/s
 *   acc  = (v - v_prev) / dt                          m/s^2   (ball acceleration)
 *   dTh  = signed bearing change a->b vs previous leg degrees
 *   res  = max(0, d - (a.acc + b.acc) / 2)            metres  (motion beyond GPS noise)
 *
 * The tremor index TI is a weighted, clamped blend:
 *
 *   TI = 0.55 * min(1, |acc| / A_REF)
 *      + 0.30 * min(1, |dTh| / 180)
 *      + 0.15 * min(1, res / R_REF)
 *
 * A_REF = 2.5 m/s^2 (a brisk stumble), R_REF = 8 m. TI is dimensionless 0..1;
 * the legend also reports the raw acceleration in m/s^2 so the scale is
 * interpretable rather than decorative.
 */

export const A_REF = 2.5; // m/s^2 — full-scale acceleration
export const R_REF = 8; // m — full-scale residual beyond GPS accuracy

export type TremorFix = { lat: number; lon: number; acc: number; at: number };

export type TremorHop = {
  from: TremorFix;
  to: TremorFix;
  /** metres */
  dist: number;
  /** seconds */
  dt: number;
  /** m/s */
  speed: number;
  /** m/s^2 — signed */
  accel: number;
  /** degrees, absolute turn between legs */
  turn: number;
  /** metres of travel beyond the reported GPS accuracy */
  residual: number;
  /** 0..1 tremor index */
  ti: number;
};

const RAD = Math.PI / 180;

export function haversine(a: TremorFix, b: TremorFix): number {
  const R = 6_371_000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearing(a: TremorFix, b: TremorFix): number {
  const dLon = (b.lon - a.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Smallest absolute angle between two bearings, 0..180. */
export function turnBetween(from: number, to: number): number {
  const d = Math.abs(((to - from + 540) % 360) - 180);
  return 180 - d;
}

/** Grade an ordered breadcrumb trail into tremor hops. */
export function tremorHops(trail: TremorFix[]): TremorHop[] {
  const hops: TremorHop[] = [];
  let prevSpeed = 0;
  let prevBearing: number | null = null;

  for (let i = 1; i < trail.length; i++) {
    const from = trail[i - 1]!;
    const to = trail[i]!;
    const dt = Math.max(0.25, (to.at - from.at) / 1000);
    const dist = haversine(from, to);
    const speed = dist / dt;
    const accel = (speed - prevSpeed) / dt;
    const br = bearing(from, to);
    const turn = prevBearing === null ? 0 : turnBetween(prevBearing, br);
    const residual = Math.max(0, dist - (from.acc + to.acc) / 2);

    const ti = Math.min(
      1,
      0.55 * Math.min(1, Math.abs(accel) / A_REF) +
        0.3 * Math.min(1, turn / 180) +
        0.15 * Math.min(1, residual / R_REF),
    );

    hops.push({ from, to, dist, dt, speed, accel, turn, residual, ti });
    prevSpeed = speed;
    prevBearing = br;
  }
  return hops;
}

/** Peak + mean tremor across the trail, for the readout. */
export function tremorSummary(hops: TremorHop[]) {
  if (!hops.length) return { peak: 0, mean: 0, peakAccel: 0 };
  let peak = 0;
  let sum = 0;
  let peakAccel = 0;
  for (const h of hops) {
    if (h.ti > peak) peak = h.ti;
    if (Math.abs(h.accel) > Math.abs(peakAccel)) peakAccel = h.accel;
    sum += h.ti;
  }
  return { peak, mean: sum / hops.length, peakAccel };
}

/* ---- colour scale ------------------------------------------------------ */

export type TremorBand = {
  /** lower bound of the band, inclusive */
  min: number;
  label: string;
  hex: string;
  /** representative acceleration for the band, m/s^2 */
  accel: string;
};

/** Five-step scale: calm -> violent. Shared by the map and the legend. */
export const TREMOR_BANDS: TremorBand[] = [
  { min: 0, label: "calm", hex: "#00ff88", accel: "<0.3" },
  { min: 0.2, label: "drift", hex: "#7cff3f", accel: "0.3–0.8" },
  { min: 0.4, label: "active", hex: "#ffcc00", accel: "0.8–1.5" },
  { min: 0.6, label: "rough", hex: "#ff9900", accel: "1.5–2.5" },
  { min: 0.8, label: "violent", hex: "#ff3366", accel: ">2.5" },
];

export function tremorBand(ti: number): TremorBand {
  let band = TREMOR_BANDS[0]!;
  for (const b of TREMOR_BANDS) if (ti >= b.min) band = b;
  return band;
}

export const tremorColor = (ti: number) => tremorBand(ti).hex;

/** Stroke weight grows with intensity so a violent hop reads on a 400px face. */
export const tremorWeight = (ti: number) => 1.5 + ti * 4;
