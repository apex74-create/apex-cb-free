/**
 * Community shell fallback — the full site-adjusted diurnal model (DTR
 * projection, dew-point floor, ENSO terms) ships only in the licensed build.
 * This fallback gives the shell an honest basic frost read: shelter-height
 * low, a simple clear-calm radiative drop and a conservative class.
 */
export type Exposure = "ridge" | "open" | "hollow";

export type NightInput = {
  iso: string;
  /** projected daytime high, degF */
  high_f: number;
  /** local dew point for that night, degF */
  dew_f: number | null;
  /** mean cloud cover 0..100 */
  cloud_pct: number | null;
  /** wind speed, mph */
  wind_mph: number | null;
};

export type NightProjection = NightInput & {
  /** adjusted diurnal range applied to the high, degF */
  dtr_adj: number;
  /** shelter-height air minimum, degF */
  low_f: number;
  /** true when the dew-point floor caught the projection */
  dew_floored: boolean;
};

export type FrostClass = "clear" | "touchdown" | "frost" | "freeze";

export type FrostRead = {
  air_f: number;
  surface_f: number;
  radiative_drop: number;
  class: FrostClass;
  /** 0..100 — how likely visible frost forms at plant height */
  risk_pct: number;
};

export function toC(f: number): number {
  return (f - 32) / 1.8;
}

export function toK(f: number): number {
  return toC(f) + 273.15;
}

/** Simple public fallback for the site-adjusted surface minimum. */
export function surfaceLow(
  night: Pick<NightProjection, "low_f" | "cloud_pct" | "wind_mph"> & {
    dew_f?: number | null;
  },
  exposure: Exposure = "open",
  canopyGap = false,
): FrostRead {
  const clear = (night.cloud_pct ?? 50) < 30;
  const calm = (night.wind_mph ?? 8) < 5;
  let drop = clear && calm ? 6 : clear ? 4 : 1.5;
  if (exposure === "hollow") drop += 2;
  if (exposure === "ridge") drop -= 1;
  if (canopyGap) drop -= 1;
  drop = Math.max(0, drop);

  let air = night.low_f;
  let dewFloored = false;
  if (night.dew_f != null && air < night.dew_f) {
    air = night.dew_f;
    dewFloored = true;
  }
  const surface = air - drop;
  const class_: FrostClass =
    surface <= 28 ? "freeze" : surface <= 32 ? "frost" : clear && calm ? "touchdown" : "clear";
  const risk = class_ === "freeze" ? 95 : class_ === "frost" ? 70 : class_ === "touchdown" ? 35 : 5;
  return { air_f: air, surface_f: surface, radiative_drop: drop, class: class_, risk_pct: risk };
}

export function firstFrostNight(
  nights: NightProjection[],
  exposure: Exposure = "open",
  canopyGap = false,
): { night: NightProjection; read: FrostRead } | null {
  for (const n of nights) {
    const read = surfaceLow(n, exposure, canopyGap);
    if (read.class === "frost" || read.class === "freeze") return { night: n, read };
  }
  return null;
}
