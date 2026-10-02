/**
 * Backup live-conditions source: MET Norway (api.met.no). Global, free, no key.
 * Normalised to the exact same shape as buildConditions so nothing downstream changes.
 */
type Details = Record<string, number | undefined>;
type Step = {
  time: string;
  data: {
    instant: { details: Details };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: Details };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: Details };
  };
};
type MetNo = { properties?: { timeseries?: Step[] } };

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const f = (c: number | null) => (c === null ? null : Math.round((c * 9) / 5 + 32));
const mph = (ms: number | null) => (ms === null ? null : Math.round(ms * 2.23694));
const inch = (mm: number | null) => (mm === null ? null : Math.round((mm / 25.4) * 100) / 100);

function describe(symbol?: string): { text: string; code: number | null } {
  const s = symbol ?? "";
  if (s.includes("thunder")) return { text: "Thunderstorm", code: 95 };
  if (s.includes("snow")) return { text: "Snow", code: 73 };
  if (s.includes("sleet")) return { text: "Freezing rain", code: 66 };
  if (s.includes("heavyrain")) return { text: "Heavy rain", code: 65 };
  if (s.includes("lightrain")) return { text: "Light rain", code: 61 };
  if (s.includes("rain")) return { text: "Rain", code: 63 };
  if (s.includes("fog")) return { text: "Fog", code: 45 };
  if (s.startsWith("cloudy")) return { text: "Overcast", code: 3 };
  if (s.startsWith("partlycloudy")) return { text: "Partly cloudy", code: 2 };
  if (s.startsWith("fair")) return { text: "Mostly clear", code: 1 };
  if (s.startsWith("clearsky")) return { text: "Clear", code: 0 };
  return { text: "Unknown", code: null };
}

export function metNoUrl(lat: number, lon: number) {
  return `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}

export async function fetchMetNo(lat: number, lon: number): Promise<MetNo> {
  const res = await fetch(metNoUrl(lat, lon), {
    headers: { Accept: "application/json", "User-Agent": "ApexSignal/1.0 tinyradr.lovable.app" },
  });
  if (!res.ok) throw new Error(`met.no failed (${res.status})`);
  return (await res.json()) as MetNo;
}

/**
 * Re-shape MET Norway into the Open-Meteo daily payload the forecast engine
 * already eats, so a rate-limited primary provider never degrades the run.
 * Units match the existing query: temps F, wind km/h, pressure hPa, cloud %.
 * MET Norway has no archive or solar sum, so past days and shortwave stay
 * empty — the engine treats missing fields as absent signals, not zeros.
 */
export function metNoAsOpenMeteoDaily(raw: MetNo) {
  const ts = raw.properties?.timeseries ?? [];
  const byDay = new Map<string, Step[]>();
  for (const s of ts) {
    const day = s.time.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const time: string[] = [];
  const tMax: Array<number | null> = [];
  const tMin: Array<number | null> = [];
  const tMean: Array<number | null> = [];
  const press: Array<number | null> = [];
  const dewMean: Array<number | null> = [];
  const dewMin: Array<number | null> = [];
  const windMax: Array<number | null> = [];
  const windDir: Array<number | null> = [];
  const cloud: Array<number | null> = [];
  const solar: Array<number | null> = [];
  for (const [date, steps] of byDay) {
    const temps = steps.map((s) => n(s.data.instant.details["air_temperature"])).filter((x): x is number => x !== null);
    const dews = steps.map((s) => n(s.data.instant.details["dew_point_temperature"])).filter((x): x is number => x !== null);
    const winds = steps.map((s) => n(s.data.instant.details["wind_speed"])).filter((x): x is number => x !== null);
    const ps = steps.map((s) => n(s.data.instant.details["air_pressure_at_sea_level"])).filter((x): x is number => x !== null);
    const cs = steps.map((s) => n(s.data.instant.details["cloud_area_fraction"])).filter((x): x is number => x !== null);
    const mid = steps.find((s) => s.time.includes("T12")) ?? steps[Math.floor(steps.length / 2)]!;
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    time.push(date);
    tMax.push(temps.length ? f(Math.max(...temps)) : null);
    tMin.push(temps.length ? f(Math.min(...temps)) : null);
    tMean.push(temps.length ? f(avg(temps)) : null);
    press.push(ps.length ? Math.round(avg(ps)! * 10) / 10 : null);
    dewMean.push(dews.length ? f(avg(dews)) : null);
    dewMin.push(dews.length ? f(Math.min(...dews)) : null);
    windMax.push(winds.length ? Math.round(Math.max(...winds) * 3.6 * 10) / 10 : null);
    windDir.push(n(mid.data.instant.details["wind_from_direction"]) ?? null);
    cloud.push(cs.length ? Math.round(avg(cs)!) : null);
    solar.push(null);
  }
  return {
    daily: {
      time,
      temperature_2m_max: tMax,
      temperature_2m_min: tMin,
      temperature_2m_mean: tMean,
      surface_pressure_mean: press,
      dew_point_2m_mean: dewMean,
      dew_point_2m_min: dewMin,
      wind_speed_10m_max: windMax,
      wind_direction_10m_dominant: windDir,
      shortwave_radiation_sum: solar,
      cloud_cover_mean: cloud,
    },
  };
}

/** Hourly temp / humidity / rain in the Open-Meteo shape (mold index input). */
export function metNoAsOpenMeteoHourly(raw: MetNo) {
  const ts = (raw.properties?.timeseries ?? []).slice(0, 96);
  return {
    hourly: {
      time: ts.map((s) => s.time),
      temperature_2m: ts.map((s) => f(n(s.data.instant.details["air_temperature"]))),
      relative_humidity_2m: ts.map((s) => n(s.data.instant.details["relative_humidity"])),
      precipitation: ts.map((s) => n(s.data.next_1_hours?.details?.["precipitation_amount"]) ?? 0),
    },
  };
}

export function buildFromMetNo(raw: MetNo, lat: number, lon: number) {
  const ts = raw.properties?.timeseries ?? [];
  if (!ts.length) throw new Error("met.no empty");
  const now = ts[0]!;
  const d = now.data.instant.details;
  const sym = now.data.next_1_hours?.summary?.symbol_code ?? now.data.next_6_hours?.summary?.symbol_code;
  const cur = describe(sym);
  const t = n(d["air_temperature"]);
  const rh = n(d["relative_humidity"]);

  const hourly = ts.slice(0, 24).map((s) => ({
    time: s.time,
    temp: f(n(s.data.instant.details["air_temperature"])),
    pop: n(s.data.next_1_hours?.details?.["probability_of_precipitation"]),
    precipitation: inch(n(s.data.next_1_hours?.details?.["precipitation_amount"])),
    wind: mph(n(s.data.instant.details["wind_speed"])),
    condition: describe(s.data.next_1_hours?.summary?.symbol_code).text,
  }));

  const byDay = new Map<string, Step[]>();
  for (const s of ts) {
    const day = s.time.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const daily = [...byDay.entries()].slice(0, 7).map(([date, steps]) => {
    const temps = steps.map((s) => n(s.data.instant.details["air_temperature"])).filter((x): x is number => x !== null);
    const winds = steps.map((s) => n(s.data.instant.details["wind_speed"])).filter((x): x is number => x !== null);
    const mid = steps.find((s) => s.time.includes("T12")) ?? steps[0]!;
    const precip = steps.reduce((a, s) => a + (n(s.data.next_1_hours?.details?.["precipitation_amount"]) ?? 0), 0);
    return {
      date,
      high: temps.length ? f(Math.max(...temps)) : null,
      low: temps.length ? f(Math.min(...temps)) : null,
      pop: null,
      precipitation: inch(precip),
      wind: winds.length ? mph(Math.max(...winds)) : null,
      condition: describe(mid.data.next_6_hours?.summary?.symbol_code ?? mid.data.next_1_hours?.summary?.symbol_code).text,
      sunrise: "",
      sunset: "",
    };
  });

  return {
    location: { lat, lon, timezone: "UTC" },
    observed_at: now.time,
    current: {
      temp: f(t),
      feels_like: f(t),
      humidity: rh,
      dew_point: f(n(d["dew_point_temperature"])),
      precipitation: inch(n(now.data.next_1_hours?.details?.["precipitation_amount"])),
      weather_code: cur.code,
      condition: cur.text,
      wind: mph(n(d["wind_speed"])),
      gust: mph(n(d["wind_speed_of_gust"])),
      wind_dir: n(d["wind_from_direction"]),
      pressure: n(d["air_pressure_at_sea_level"]),
      cloud_cover: n(d["cloud_area_fraction"]),
      is_day: !!sym && !sym.includes("night"),
    },
    hourly,
    daily,
    source: "met.no",
  };
}
