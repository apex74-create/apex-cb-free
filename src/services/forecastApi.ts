export type SubscriptionTier = "free" | "pro" | "enterprise" | "operator";
export type BillingTier = "free" | "pro" | "elite" | "enterprise" | string;

export type SignalWeight = { key: string; label: string; weight: number };

export type WaveMetadata = {
  latitude: number;
  longitude: number;
  peak_date: string;
  peak_intensity: number;
  confidence_score: number;
  enso_state: string;
  peak_anomaly?: number;
  anchored?: boolean;
  observations_used?: number;
  observation_coverage?: number;
  window?: { start: string; end: string };
  window_hold_anomaly?: number;
  window_days_above_normal?: number;
  stretch_ratio?: number;
  signal_weights?: SignalWeight[];
  confidence_basis?: string;
  /** Ocean-state analog years the synthesis learned from, with their weights. */
  analog_years?: Array<{ year: number; score: number }>;
  /** 0..1 — how tightly those analog years agreed with each other. */
  analog_agreement?: number;
  /** "V1" general synthesis, "V2" analog-shift with reset-node collapse. */
  model_tier?: "V1" | "V2";
  /** V2: the hard frost that resets soil thermal mass before the rebound. */
  reset_node?: { iso: string; temp: number } | null;
  /** V2: a pre-reset maximum that was recorded and suppressed, not published. */
  false_peak?: { iso: string; temp: number; suppressed_to: number } | null;
  /** V2: days between the reset node and the true collapse. */
  rebound_days?: number | null;
  /** degF the forward projection was shifted to match the last measured days. */
  measurement_correction?: number;
  /** how many measured days the correction was averaged over. */
  measurement_days_used?: number;
  /** the most recent measured day: its high and its daily mean. */
  last_measured?: { iso: string; high: number | null; mean: number | null } | null;
  /** degF the next few days were nudged by this device's own sensors. */
  sensor_correction?: number;
  /** what the device sensors actually reported, or nulls when absent. */
  sensor_inputs?: {
    temp: number | null;
    pressure: number | null;
    trend: number | null;
  } | null;
  /** 100-mile upwind water-fetch normalization applied to the forward curve. */
  microclimate?: {
    level_shift: number;
    local_baseline: number;
    upwind_water: number;
    water_bodies: import("@/lib/engines/microclimate").WaterContribution[];
    wind_from_deg: number | null;
    wind_speed_mph: number | null;
    confidence: number;
    model_weight: number;
  } | null;
  /** crop pathogen pressure for the next few days, or null when unavailable. */
  microclimate_mold_index?: import("@/lib/engines/mold-index").MoldIndexResult | null;
  /** projected nightly lows (DTR^2 with dew-point floor) for the frost watch. */
  nightly_lows?: {
    dtr_72h: number | null;
    dtr_trailing: number | null;
    dtr_days: number;
    nights: import("@/lib/engines/diurnal").NightProjection[];
  } | null;
  /** degF the next few days were nudged by the surrounding field array. */
  mesh_correction?: number;
  /** mean of the nearby stations reporting in the last few hours. */
  mesh_inputs?: {
    nodes: number;
    pressure_trend: number | null;
    temp_f: number | null;
    signal_score: number | null;
  } | null;
  /** the 369 gate every aggregate reading passes before it may move the curve. */
  ternary?: {
    state: 3 | 6 | 9;
    label: string;
    agreement: number;
    gain: number;
    voting: number;
    witnesses: number;
    nodes: number;
    amplitudes: { three: number; six: number; nine: number };
    trits: Array<{ key: string; tri: 3 | 6 | 9 }>;
  } | null;
};

export type WaveTimelinePoint = {
  date: string;
  iso?: string;
  temp: number;
  baseline: number;
  elNino: number;
  observed?: boolean;
  /** Weighted composite of what the matched analog years did on this date. */
  analog?: number;
};

export type TurningPoint = {
  iso: string;
  kind: "trough" | "peak";
  temp: number;
  slope: number;
};

export type WaveForecastResponse = {
  metadata: WaveMetadata;
  timeline: WaveTimelinePoint[];
  turning_points?: TurningPoint[];
  /** "wave-collapse" = external model host; "wave-collapse-local" = in-app engine. */
  source?: "wave-collapse" | "wave-collapse-local" | "public-fallback" | string;
  notice?: string;
};

const TIER_DAY_LIMIT: Record<SubscriptionTier, number> = {
  free: 7,
  pro: 62,
  enterprise: 62,
  // Owner build: no horizon limit at all.
  operator: Number.POSITIVE_INFINITY,
};

export function tierDayLimit(tier: SubscriptionTier): number {
  return TIER_DAY_LIMIT[tier];
}

/**
 * Measured history is never trimmed — only the forward projection is gated.
 * `todayIso` marks the boundary; everything on or before it is kept.
 */
export function trimTimelineByTier(
  timeline: WaveTimelinePoint[],
  tier: SubscriptionTier,
  todayIso: string = new Date().toISOString().slice(0, 10),
): WaveTimelinePoint[] {
  const limit = tierDayLimit(tier);
  if (!Number.isFinite(limit)) return timeline;
  const past = timeline.filter((p) => !p.iso || p.iso <= todayIso);
  const forward = timeline.filter((p) => p.iso && p.iso > todayIso);
  return [...past, ...forward.slice(0, limit)];
}

export function inIndianSummerWindow(isoDate: string): boolean {
  const monthDay = isoDate.slice(5, 10);
  return monthDay >= "09-22" && monthDay <= "10-06";
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function timelineLabelToIsoDate(label: string, referenceDate = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const match = /^([A-Za-z]{3})\s+(\d{1,2})$/.exec(label.trim());
  if (!match) return `${year}-01-01`;

  const month = MONTHS[(match[1] ?? "").toLowerCase()];
  const day = Number(match[2]);
  if (month === undefined || !Number.isInteger(day) || day < 1 || day > 31) {
    return `${year}-01-01`;
  }

  let parsed = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(parsed.getTime())) return `${year}-01-01`;

  const referenceUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  if (parsed.getTime() < referenceUtc - 31 * 24 * 60 * 60 * 1000) {
    parsed = new Date(Date.UTC(year + 1, month, day));
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeSubscriptionTier(tier: BillingTier): SubscriptionTier {
  if (tier === "operator") return "operator";
  if (tier === "enterprise" || tier === "elite") return "enterprise";
  if (tier === "pro") return "pro";
  return "free";
}

/** Last station average used, for the source line on the forecast page. */
export let lastStationBlend: import("@/lib/wx-stations").StationBlend | null = null;

export async function fetchWaveForecast(params: {
  lat: number;
  lon: number;
  /** forward horizon in days */
  days?: number;
  /** measured history to include before today */
  past?: number;
  /** optional on-device sensor sweep, from sweepParams() */
  sensor?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<WaveForecastResponse> {
  const sensor = { ...(params.sensor ?? {}) };
  // Fill missing live readings from the neighborhood station average.
  if (!sensor["sensor_temp"] || !sensor["sensor_pressure"]) {
    try {
      const wx = await import("@/lib/wx-stations");
      await wx.loadNwsStations(params.lat, params.lon).catch(() => undefined);
      const b = wx.blendStations(params.lat, params.lon);
      lastStationBlend = b;
      if (b?.tempF != null && !sensor["sensor_temp"]) sensor["sensor_temp"] = b.tempF.toFixed(1);
      if (b?.pressureHpa != null && !sensor["sensor_pressure"]) sensor["sensor_pressure"] = b.pressureHpa.toFixed(1);
    } catch {
      /* stations are a bonus, never a blocker */
    }
  }
  const query = new URLSearchParams({
    lat: params.lat.toFixed(5),
    lon: params.lon.toFixed(5),
    days: String(params.days ?? 365),
    past: String(params.past ?? 14),
    ...sensor,
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers["Authorization"] = `Bearer ${data.session.access_token}`;
  } catch {
    /* anonymous callers get the free horizon */
  }
  // Pull the public feeds from the handset's own connection. The shared
  // server address gets rate-limited by the provider, which left the engine
  // unanchored ("degraded") with no dew/VPD index.
  const feeds = await fetchHandsetFeeds(params.lat, params.lon, params.past ?? 14, params.signal);
  headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/public/forecast?${query.toString()}`, {
    method: "POST",
    ...(params.signal ? { signal: params.signal } : {}),
    headers,
    body: JSON.stringify(feeds),
  });
  if (!res.ok) {
    throw new Error(`forecast api failed (${res.status})`);
  }
  return (await res.json()) as WaveForecastResponse;
}

async function fetchHandsetFeeds(
  lat: number,
  lon: number,
  past: number,
  signal?: AbortSignal,
): Promise<{ daily?: unknown; hourly?: unknown }> {
  const base = "https://api.open-meteo.com/v1/forecast?";
  const daily = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      "temperature_2m_max,temperature_2m_min,temperature_2m_mean,surface_pressure_mean,dew_point_2m_mean,dew_point_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum,cloud_cover_mean",
    temperature_unit: "fahrenheit",
    past_days: String(Math.max(0, Math.min(past, 92))),
    forecast_days: "16",
    timezone: "auto",
  });
  const hourly = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,relative_humidity_2m,precipitation",
    temperature_unit: "fahrenheit",
    forecast_days: "4",
    timezone: "UTC",
  });
  const get = async (q: URLSearchParams) => {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    try {
      const r = await fetch(base + q.toString(), signal ? { signal } : {});
      return r.ok ? ((await r.json()) as unknown) : undefined;
    } catch (err) {
      // A cancelled request must stop the whole chain, not fall through.
      if (signal?.aborted) throw err;
      return undefined;
    }
  };
  const getRetry = async (q: URLSearchParams) =>
    (await get(q)) ??
    (await new Promise((r) => setTimeout(r, 900)).then(() => get(q)));
  let [d, h] = await Promise.all([getRetry(daily), getRetry(hourly)]);
  // Second source: MET Norway (global, free, no key) re-shaped to the same
  // payload, so one provider's rate limit can never degrade the forecast.
  if (!d || !h) {
    try {
      const mn = await import("@/lib/conditions-metno");
      const raw = await mn.fetchMetNo(lat, lon);
      if (!d) d = mn.metNoAsOpenMeteoDaily(raw);
      if (!h) h = mn.metNoAsOpenMeteoHourly(raw);
    } catch {
      /* backup unavailable — cache below is the final net */
    }
  }
  // Keep the last good feed per spot so a brief provider hiccup or rate
  // limit doesn't drop the forecast to unanchored. Stale after 6 hours.
  const key = `apex.wx.feeds.${lat.toFixed(1)},${lon.toFixed(1)}`;
  const MAX_AGE = 6 * 3600_000;
  try {
    if (d && h) {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), daily: d, hourly: h }));
      return { daily: d, hourly: h };
    }
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as
      | { at: number; daily?: unknown; hourly?: unknown }
      | null;
    if (saved && Date.now() - saved.at < MAX_AGE) {
      return { daily: d ?? saved.daily, hourly: h ?? saved.hourly };
    }
  } catch {
    /* storage unavailable — fall through */
  }
  return { daily: d, hourly: h };
}
