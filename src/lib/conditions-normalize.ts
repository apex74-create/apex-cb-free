/** Shared by the conditions route and the handset fallback — one normaliser. */
const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm, hail",
  99: "Thunderstorm, hail",
};

export function describeWeatherCode(code: number | null | undefined): string {
  if (code === null || code === undefined) return "Unknown";
  return WMO[code] ?? "Unsettled";
}

export type OpenMeteo = {
  current?: Record<string, number | string | null>;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
  timezone?: string;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);


export function conditionsQuery(lat: number, lon: number): string {
  return new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,cloud_cover,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    forecast_days: "7",
    forecast_hours: "24",
    timezone: "auto",
  }).toString();
}

export function buildConditions(raw: OpenMeteo, lat: number, lon: number, source = "observations") {
  const c = raw.current ?? {};
  const hTime = (raw.hourly?.["time"] ?? []) as string[];
  const dTime = (raw.daily?.["time"] ?? []) as string[];

  return {
    location: { lat, lon, timezone: raw.timezone ?? "UTC" },
    observed_at: typeof c["time"] === "string" ? c["time"] : new Date().toISOString(),
    current: {
      temp: num(c["temperature_2m"]),
      feels_like: num(c["apparent_temperature"]),
      humidity: num(c["relative_humidity_2m"]),
      dew_point: num(c["dew_point_2m"]),
      precipitation: num(c["precipitation"]),
      weather_code: num(c["weather_code"]),
      condition: describeWeatherCode(num(c["weather_code"])),
      wind: num(c["wind_speed_10m"]),
      gust: num(c["wind_gusts_10m"]),
      wind_dir: num(c["wind_direction_10m"]),
      pressure: num(c["surface_pressure"]),
      cloud_cover: num(c["cloud_cover"]),
      is_day: num(c["is_day"]) === 1,
    },
    hourly: hTime.map((time, i) => ({
      time,
      temp: num(raw.hourly?.["temperature_2m"]?.[i]),
      pop: num(raw.hourly?.["precipitation_probability"]?.[i]),
      precipitation: num(raw.hourly?.["precipitation"]?.[i]),
      wind: num(raw.hourly?.["wind_speed_10m"]?.[i]),
      condition: describeWeatherCode(num(raw.hourly?.["weather_code"]?.[i])),
    })),
    daily: dTime.map((date, i) => ({
      date,
      high: num(raw.daily?.["temperature_2m_max"]?.[i]),
      low: num(raw.daily?.["temperature_2m_min"]?.[i]),
      pop: num(raw.daily?.["precipitation_probability_max"]?.[i]),
      precipitation: num(raw.daily?.["precipitation_sum"]?.[i]),
      wind: num(raw.daily?.["wind_speed_10m_max"]?.[i]),
      condition: describeWeatherCode(num(raw.daily?.["weather_code"]?.[i])),
      sunrise: String(raw.daily?.["sunrise"]?.[i] ?? ""),
      sunset: String(raw.daily?.["sunset"]?.[i] ?? ""),
    })),
    source,
  };

}
