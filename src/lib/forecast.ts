export type ForecastCurrent = {
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidity: number | null;
  windKph: number | null;
  windDirection: number | null;
  weatherCode: number;
  label: string;
};

export type ForecastHour = {
  time: string;
  temperatureC: number;
  precipChance: number | null;
  weatherCode: number;
  label: string;
};

export type ForecastDay = {
  date: string;
  maxC: number;
  minC: number;
  precipChance: number | null;
  weatherCode: number;
  label: string;
};

export type ForecastPayload = {
  latitude: number;
  longitude: number;
  timezone: string;
  source: "edge" | "direct";
  current: ForecastCurrent;
  hourly: ForecastHour[];
  daily: ForecastDay[];
};

type OpenMeteoRaw = {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: Array<number | null>;
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: Array<number | null>;
    weather_code?: number[];
  };
};

const CONDITIONS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "light freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  85: "light snow showers",
  86: "snow showers",
  95: "thunderstorm",
  96: "storm + hail",
  99: "severe storm",
};

export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "4",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function weatherLabel(code: number | null | undefined): string {
  return typeof code === "number" ? (CONDITIONS[code] ?? `code ${code}`) : "unknown";
}

export function normalizeForecast(
  raw: OpenMeteoRaw,
  source: ForecastPayload["source"],
): ForecastPayload {
  const currentCode = raw.current?.weather_code ?? -1;
  const hourlyTime = raw.hourly?.time ?? [];
  const hourlyTemp = raw.hourly?.temperature_2m ?? [];
  const hourlyCode = raw.hourly?.weather_code ?? [];
  const hourlyPrecip = raw.hourly?.precipitation_probability ?? [];
  const currentTime = raw.current?.time ?? hourlyTime[0] ?? new Date().toISOString();
  const startIndex = Math.max(
    0,
    hourlyTime.findIndex((entry) => entry >= currentTime),
  );

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone || "auto",
    source,
    current: {
      time: currentTime,
      temperatureC: Number(raw.current?.temperature_2m ?? hourlyTemp[startIndex] ?? 0),
      apparentTemperatureC: Number(
        raw.current?.apparent_temperature ??
          raw.current?.temperature_2m ??
          hourlyTemp[startIndex] ??
          0,
      ),
      humidity:
        typeof raw.current?.relative_humidity_2m === "number"
          ? raw.current.relative_humidity_2m
          : null,
      windKph: typeof raw.current?.wind_speed_10m === "number" ? raw.current.wind_speed_10m : null,
      windDirection:
        typeof raw.current?.wind_direction_10m === "number" ? raw.current.wind_direction_10m : null,
      weatherCode: currentCode,
      label: weatherLabel(currentCode),
    },
    hourly: hourlyTime.slice(startIndex, startIndex + 6).map((time, index) => {
      const sourceIndex = startIndex + index;
      const code = hourlyCode[sourceIndex] ?? -1;
      return {
        time,
        temperatureC: Number(hourlyTemp[sourceIndex] ?? 0),
        precipChance:
          typeof hourlyPrecip[sourceIndex] === "number"
            ? (hourlyPrecip[sourceIndex] ?? null)
            : null,
        weatherCode: code,
        label: weatherLabel(code),
      };
    }),
    daily: (raw.daily?.time ?? []).slice(0, 4).map((date, index) => {
      const code = raw.daily?.weather_code?.[index] ?? -1;
      return {
        date,
        maxC: Number(raw.daily?.temperature_2m_max?.[index] ?? 0),
        minC: Number(raw.daily?.temperature_2m_min?.[index] ?? 0),
        precipChance:
          typeof raw.daily?.precipitation_probability_max?.[index] === "number"
            ? (raw.daily?.precipitation_probability_max?.[index] ?? null)
            : null,
        weatherCode: code,
        label: weatherLabel(code),
      };
    }),
  };
}

async function requestForecast(
  url: string,
  source: ForecastPayload["source"],
): Promise<ForecastPayload> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`forecast failed (${response.status})`);
  return normalizeForecast((await response.json()) as OpenMeteoRaw, source);
}

export async function fetchForecast(latitude: number, longitude: number): Promise<ForecastPayload> {
  try {
    return await requestForecast(`/api/public/forecast?lat=${latitude}&lon=${longitude}`, "edge");
  } catch {
    return requestForecast(forecastUrl(latitude, longitude), "direct");
  }
}

export function formatForecastHour(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", hour12: false });
}

export function formatForecastDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { weekday: "short" }).toUpperCase();
}
