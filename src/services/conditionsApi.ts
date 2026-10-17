export type CurrentConditions = {
  temp: number | null;
  feels_like: number | null;
  humidity: number | null;
  dew_point: number | null;
  precipitation: number | null;
  weather_code: number | null;
  condition: string;
  wind: number | null;
  gust: number | null;
  wind_dir: number | null;
  pressure: number | null;
  cloud_cover: number | null;
  is_day: boolean;
};

export type HourlyPoint = {
  time: string;
  temp: number | null;
  pop: number | null;
  precipitation: number | null;
  wind: number | null;
  condition: string;
};

export type DailyPoint = {
  date: string;
  high: number | null;
  low: number | null;
  pop: number | null;
  precipitation: number | null;
  wind: number | null;
  condition: string;
  sunrise: string;
  sunset: string;
};

export type ConditionsResponse = {
  location: { lat: number; lon: number; timezone: string };
  observed_at: string;
  current: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  source: string;
};

export async function fetchConditions(params: {
  lat: number;
  lon: number;
  signal?: AbortSignal;
}): Promise<ConditionsResponse> {
  // Handset first: its own connection isn't rate-limited by the feed the way
  // the shared server address is. The server route is the fallback.
  const { buildConditions, conditionsQuery } = await import("@/lib/conditions-normalize");
  try {
    const direct = await fetch(
      `https://api.open-meteo.com/v1/forecast?${conditionsQuery(params.lat, params.lon)}`,
      params.signal ? { signal: params.signal } : {},
    );
    if (direct.ok) {
      return buildConditions(await direct.json(), params.lat, params.lon, "handset") as ConditionsResponse;
    }
  } catch (err) {
    if (params.signal?.aborted) throw err;
  }
  const query = new URLSearchParams({
    lat: params.lat.toFixed(5),
    lon: params.lon.toFixed(5),
  });
  const res = await fetch(`/api/public/conditions?${query.toString()}`, {
    headers: { Accept: "application/json" },
    ...(params.signal ? { signal: params.signal } : {}),
  });
  if (!res.ok) throw new Error(`conditions unavailable (${res.status})`);
  return (await res.json()) as ConditionsResponse;
}

export const compass = (deg: number | null): string => {
  if (deg === null) return "--";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round(deg / 22.5) % 16] ?? "N";
};

export const dayLabel = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
};
