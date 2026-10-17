/**
 * Weather stations — official NWS stations when online, plus ham-radio
 * (APRS) weather stations heard by a receiver on the USB cable when off-grid.
 *
 * Every reading lands in one local store; the neighborhood average weights
 * closer, fresher, official readings more and throws out stale or impossible
 * values. The average feeds the forecast's existing live-observation input.
 */

export type StationSource = "nws" | "aprs";
export type StationObs = {
  id: string;
  name: string;
  source: StationSource;
  lat: number;
  lon: number;
  at: number;
  tempF?: number | undefined;
  dewF?: number | undefined;
  rh?: number | undefined;
  windMph?: number | undefined;
  gustMph?: number | undefined;
  windDir?: number | undefined;
  pressureHpa?: number | undefined;
  rainIn?: number | undefined;
};

export const STATION_MAX_AGE_MS = 90 * 60_000;
const store = new Map<string, StationObs>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function putStation(o: StationObs) {
  const prev = store.get(o.id);
  if (prev && prev.at >= o.at) return;
  store.set(o.id, o);
  emit();
}
export function stations(): StationObs[] {
  const now = Date.now();
  return [...store.values()].filter((s) => now - s.at < STATION_MAX_AGE_MS * 4);
}
export function onStations(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

export function milesBetween(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/* ---- NWS (online) ------------------------------------------------------ */

const cToF = (c: number | null | undefined) => (c == null ? undefined : (c * 9) / 5 + 32);
const kmhToMph = (v: number | null | undefined) => (v == null ? undefined : v * 0.621371);
const val = (o: { value?: number | null } | undefined) => o?.value ?? undefined;
let nwsKey = "";
let nwsAt = 0;

export async function loadNwsStations(lat: number, lon: number, max = 8) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (key === nwsKey && Date.now() - nwsAt < 10 * 60_000) return;
  nwsKey = key;
  nwsAt = Date.now();
  const h = { Accept: "application/geo+json" };
  const pt = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: h });
  if (!pt.ok) return;
  const url = (await pt.json())?.properties?.observationStations as string | undefined;
  if (!url) return;
  const list = await (await fetch(url, { headers: h })).json();
  const feats = ((list?.features ?? []) as any[]).slice(0, max);
  await Promise.all(
    feats.map(async (f) => {
      const id = f.properties?.stationIdentifier as string;
      const [slon, slat] = f.geometry?.coordinates ?? [];
      try {
        const r = await fetch(`https://api.weather.gov/stations/${id}/observations/latest`, { headers: h });
        if (!r.ok) return;
        const p = (await r.json())?.properties;
        if (!p) return;
        const pa = val(p.barometricPressure) ?? val(p.seaLevelPressure);
        putStation({
          id: `nws:${id}`,
          name: `${id} · ${f.properties?.name ?? ""}`.trim(),
          source: "nws",
          lat: slat,
          lon: slon,
          at: Date.parse(p.timestamp) || Date.now(),
          tempF: cToF(val(p.temperature)),
          dewF: cToF(val(p.dewpoint)),
          rh: val(p.relativeHumidity),
          windMph: kmhToMph(val(p.windSpeed)),
          gustMph: kmhToMph(val(p.windGust)),
          windDir: val(p.windDirection),
          pressureHpa: pa == null ? undefined : pa / 100,
        });
      } catch {
        /* one station down is fine */
      }
    }),
  );
}

/* ---- APRS weather packets (off-grid, via receiver) --------------------- */

/**
 * Parse the weather part of an APRS position+weather report, e.g.
 * "N0CALL>APRS:!4500.00N/08440.00W_220/004g005t045r000p000P000h85b10132"
 */
export function parseAprsWx(raw: string, at = Date.now()): StationObs | null {
  const m = /^([A-Z0-9-]{3,9})>[^:]*:[!=@/](?:\d{6}[hz/])?(\d{2})(\d{2}\.\d{2})([NS]).(\d{3})(\d{2}\.\d{2})([EW])_(.*)$/.exec(
    raw.trim(),
  );
  if (!m) return null;
  const lat = (Number(m[2]) + Number(m[3]) / 60) * (m[4] === "S" ? -1 : 1);
  const lon = (Number(m[5]) + Number(m[6]) / 60) * (m[7] === "W" ? -1 : 1);
  const w = m[8]!;
  const num = (re: RegExp) => {
    const x = re.exec(w)?.[1];
    return x && !/^\.+$/.test(x) ? Number(x) : undefined;
  };
  const dirSpd = /^(\d{3}|\.{3})\/(\d{3}|\.{3})/.exec(w);
  const b = num(/b(\d{5})/);
  const h = num(/h(\d{2})/);
  const r = num(/r(\d{3})/);
  return {
    id: `aprs:${m[1]}`,
    name: m[1]!,
    source: "aprs",
    lat,
    lon,
    at,
    windDir: dirSpd && !dirSpd[1]!.startsWith(".") ? Number(dirSpd[1]) : undefined,
    windMph: dirSpd && !dirSpd[2]!.startsWith(".") ? Number(dirSpd[2]) : undefined,
    gustMph: num(/g(\d{3})/),
    tempF: num(/t(-?\d{2,3})/),
    rainIn: r == null ? undefined : r / 100,
    rh: h == null ? undefined : h === 0 ? 100 : h,
    pressureHpa: b == null ? undefined : b / 10,
  };
}

/* ---- kinematic weighting: age decay + upwind advection ----------------- */

/**
 * Tunable model profile. Every constant the kinematic blend uses lives here
 * so an enterprise forecaster can sharpen the engine against their own
 * real-time observations without touching the math. Ship `DEFAULT_TUNING`
 * unchanged; tuned models are an API offering.
 */
export type WxTuning = {
  /** Recency time constant (minutes): a frame τ old keeps ~37% weight. */
  ageTauMin: number;
  /** Trust multiplier per station source. */
  sourceTier: Record<StationSource, number>;
  /** Inverse-distance exponent: higher = nearby stations dominate. */
  distanceExp: number;
  /** Blend radius in miles. */
  radiusMi: number;
  /** Minimum wind (mph) before advection is considered. */
  minWindMph: number;
  /** Half-angle (degrees) of the upwind cone. */
  upwindConeDeg: number;
  /** Peak weight multiplier for an arriving upwind frame (1 + boost). */
  advectionBoostMax: number;
  /** Arrival-time width (minutes) of the boost bell curve. */
  advectionEtaSigmaMin: number;
  /** Only flag arrivals within this many minutes. */
  incomingWindowMin: number;
};

export const DEFAULT_TUNING: WxTuning = {
  ageTauMin: 15,
  sourceTier: { nws: 1, aprs: 0.6 },
  distanceExp: 2,
  radiusMi: 25,
  minWindMph: 3,
  upwindConeDeg: 45,
  advectionBoostMax: 1.5,
  advectionEtaSigmaMin: 10,
  incomingWindowMin: 60,
};

/** Recency time constant (minutes): a 15-min-old frame keeps ~37% weight. */
export const AGE_TAU_MIN = DEFAULT_TUNING.ageTauMin;
export const SOURCE_TIER: Record<StationSource, number> = DEFAULT_TUNING.sourceTier;

/** Exponential recency weight W_age = e^(−age/τ). */
export function ageWeight(ageMs: number, tauMin = AGE_TAU_MIN) {
  return Math.exp(-Math.max(ageMs, 0) / 60_000 / tauMin);
}

function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180;
  const y = Math.sin((bLon - aLon) * r) * Math.cos(bLat * r);
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLon - aLon) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

export type Advection = { etaMin: number; miles: number; alignment: number };

/**
 * If the station is upwind of the user, estimate minutes until what it
 * measured arrives here (negative = already passed). Wind dir is "from".
 * Returns null when the station is not within the 45° upwind cone or calm.
 */
export function calculateAdvectionArrival(
  lat: number,
  lon: number,
  s: Pick<StationObs, "lat" | "lon" | "at" | "windDir" | "windMph">,
  now = Date.now(),
  t: WxTuning = DEFAULT_TUNING,
): Advection | null {
  if (s.windDir == null || !s.windMph || s.windMph < t.minWindMph) return null;
  const toward = (s.windDir + 180) % 360;
  const b = bearingDeg(s.lat, s.lon, lat, lon);
  const diff = Math.abs(((toward - b + 540) % 360) - 180);
  if (diff > t.upwindConeDeg) return null;
  const miles = milesBetween(lat, lon, s.lat, s.lon);
  const alignment = Math.cos((diff * Math.PI) / 180);
  const transitMin = (miles / (s.windMph * alignment)) * 60;
  return { etaMin: transitMin - (now - s.at) / 60_000, miles, alignment };
}

/** Upwind frames about to arrive regain weight instead of decaying out. */
export function advectionBoost(a: Advection | null, t: WxTuning = DEFAULT_TUNING) {
  if (!a) return 1;
  return 1 + t.advectionBoostMax * a.alignment * Math.exp(-((a.etaMin / t.advectionEtaSigmaMin) ** 2));
}

/* ---- neighborhood average --------------------------------------------- */

export type StationBlend = {
  count: number;
  avgMiles: number;
  ageMin: number;
  tempF?: number | undefined;
  pressureHpa?: number | undefined;
  /** Soonest upwind arrival within the next hour, if any. */
  incoming?: { id: string; etaMin: number; gustMph?: number | undefined } | undefined;
};

export function blendStations(
  lat: number,
  lon: number,
  list = stations(),
  radiusMi?: number,
  tuning: WxTuning = DEFAULT_TUNING,
): StationBlend | null {
  const now = Date.now();
  const radius = radiusMi ?? tuning.radiusMi;
  const use = list
    .map((s) => {
      const d = milesBetween(lat, lon, s.lat, s.lon);
      const age = now - s.at;
      const adv = calculateAdvectionArrival(lat, lon, s, now, tuning);
      const w =
        (1 / (1 + d) ** tuning.distanceExp) *
        ageWeight(age, tuning.ageTauMin) *
        tuning.sourceTier[s.source] *
        advectionBoost(adv, tuning);
      return { s, d, age, adv, w };
    })
    .filter((x) => x.d <= radius && x.age < STATION_MAX_AGE_MS);
  if (!use.length) return null;
  const wavg = (pick: (s: StationObs) => number | undefined, lo: number, hi: number) => {
    let n = 0;
    let t = 0;
    for (const { s, w } of use) {
      const v = pick(s);
      if (v == null || !Number.isFinite(v) || v < lo || v > hi) continue;
      n += w;
      t += v * w;
    }
    return n > 0 ? t / n : undefined;
  };
  const inc = use
    .filter((x) => x.adv && x.adv.etaMin >= 0 && x.adv.etaMin <= tuning.incomingWindowMin)
    .sort((a, b) => a.adv!.etaMin - b.adv!.etaMin)[0];
  return {
    count: use.length,
    avgMiles: use.reduce((a, x) => a + x.d, 0) / use.length,
    ageMin: Math.round(use.reduce((a, x) => a + x.age, 0) / use.length / 60_000),
    tempF: wavg((s) => s.tempF, -60, 130),
    pressureHpa: wavg((s) => s.pressureHpa, 850, 1090),
    incoming: inc ? { id: inc.s.id, etaMin: Math.round(inc.adv!.etaMin), gustMph: inc.s.gustMph } : undefined,
  };
}

/* ---- mesh relay: phones without a receiver still get station readings -- */
import { onLinkFrame } from "@/lib/cb-links";
let meshOn = false;
export function listenMeshWx() {
  if (meshOn) return;
  meshOn = true;
  onLinkFrame((f) => {
    if (typeof f.body === "string" && f.body.startsWith("WX1:")) {
      const o = parseAprsWx(f.body.slice(4), f.ts);
      if (o) putStation(o);
    }
  });
}
