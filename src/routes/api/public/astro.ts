import { createFileRoute } from "@tanstack/react-router";
import { correlate, lunarSeries, moonPhase } from "@/lib/astro";

/**
 * Daily solar, lunar and seismic inputs for one location, plus the
 * cross-correlations between them and the local temperature record.
 *
 * Public data only: Open-Meteo for solar radiation and temperature, USGS for
 * earthquakes. No key, no account, no per-device identifier.
 */

type Daily = {
  time?: string[];
  temperature_2m_mean?: Array<number | null>;
  shortwave_radiation_sum?: Array<number | null>;
  surface_pressure_mean?: Array<number | null>;
};

type Quake = {
  time: string;
  mag: number;
  place: string;
  km: number;
  depth: number | null;
};

const CACHE = new Map<string, { at: number; body: string }>();
const TTL_MS = 10 * 60 * 1000;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchDaily(lat: number, lon: number, past: number, pre?: Daily): Promise<Daily> {
  // Handset-fetched feed first: the shared server address gets rate-limited.
  if (pre?.time?.length) return pre;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "temperature_2m_mean,shortwave_radiation_sum,surface_pressure_mean",
    temperature_unit: "fahrenheit",
    past_days: String(past),
    forecast_days: "16",
    timezone: "UTC",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (res.ok) {
    const json = (await res.json()) as { daily?: Daily };
    return json.daily ?? {};
  }
  // Second source: MET Norway (no solar sum — that series stays null).
  const mn = await import("@/lib/conditions-metno");
  const alt = mn.metNoAsOpenMeteoDaily(await mn.fetchMetNo(lat, lon));
  return {
    time: alt.daily.time,
    temperature_2m_mean: alt.daily.temperature_2m_mean,
    surface_pressure_mean: alt.daily.surface_pressure_mean,
    shortwave_radiation_sum: alt.daily.shortwave_radiation_sum,
  };
}

async function fetchQuakes(lat: number, lon: number, radiusKm: number): Promise<Quake[]> {
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    format: "geojson",
    starttime: start,
    latitude: String(lat),
    longitude: String(lon),
    maxradiuskm: String(radiusKm),
    minmagnitude: "1.5",
    orderby: "time",
    limit: "60",
  });
  const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`seismic feed failed (${res.status})`);
  const json = (await res.json()) as {
    features?: Array<{
      properties?: { time?: number; mag?: number | null; place?: string };
      geometry?: { coordinates?: number[] };
    }>;
  };
  return (json.features ?? [])
    .map((f) => {
      const coords = f.geometry?.coordinates ?? [];
      const qlon = typeof coords[0] === "number" ? coords[0] : lon;
      const qlat = typeof coords[1] === "number" ? coords[1] : lat;
      return {
        time: new Date(f.properties?.time ?? Date.now()).toISOString(),
        mag: typeof f.properties?.mag === "number" ? f.properties.mag : 0,
        place: f.properties?.place ?? "unknown",
        km: Math.round(haversineKm(lat, lon, qlat, qlon)),
        depth: typeof coords[2] === "number" ? coords[2] : null,
      };
    })
    .filter((q) => q.mag > 0);
}

/** Released energy per day, log scale, aligned to the date list. */
function seismicSeries(dates: string[], quakes: Quake[]): Array<number | null> {
  const byDay = new Map<string, number>();
  for (const q of quakes) {
    const day = q.time.slice(0, 10);
    // Magnitude is logarithmic; sum the energy, then take the log back.
    byDay.set(day, (byDay.get(day) ?? 0) + 10 ** (1.5 * q.mag));
  }
  return dates.map((d) => {
    const e = byDay.get(d);
    return typeof e === "number" && e > 0 ? Number((Math.log10(e) / 1.5).toFixed(2)) : 0;
  });
}

export const Route = createFileRoute("/api/public/astro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let pre: Daily | undefined;
        try {
          const body = (await request.json()) as { daily?: Daily };
          if (body?.daily && Array.isArray(body.daily.time)) pre = body.daily;
        } catch {
          /* empty body — fall back to the server fetch */
        }
        return handle(request, pre);
      },
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request, pre?: Daily): Promise<Response> {
  {
    {
      {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat") ?? "44.98");
        const lon = Number(url.searchParams.get("lon") ?? "-84.60");
        const past = Math.max(14, Math.min(Number(url.searchParams.get("past") ?? "90"), 365));
        const radius = Math.max(50, Math.min(Number(url.searchParams.get("radius") ?? "500"), 2000));

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return Response.json({ error: "lat and lon must be numbers" }, { status: 400 });
        }

        const key = `${lat.toFixed(2)},${lon.toFixed(2)},${past},${radius}`;
        const hit = CACHE.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) {
          return new Response(hit.body, {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
          });
        }

        try {
          const [daily, quakes] = await Promise.all([
            fetchDaily(lat, lon, past, pre),
            fetchQuakes(lat, lon, radius).catch(() => [] as Quake[]),
          ]);
          const dates = daily.time ?? [];
          const temp = daily.temperature_2m_mean ?? [];
          const solar = daily.shortwave_radiation_sum ?? [];
          const pressure = daily.surface_pressure_mean ?? [];
          const lunar = lunarSeries(dates);
          const seismic = seismicSeries(dates, quakes);

          const days = dates.map((iso, i) => ({
            date: iso,
            temp_f: temp[i] ?? null,
            solar: solar[i] ?? null,
            pressure: pressure[i] ?? null,
            lunar: lunar[i] ?? null,
            seismic: seismic[i] ?? 0,
            moon: moonPhase(iso).label,
          }));

          const body = JSON.stringify({
            location: { lat, lon },
            days,
            quakes: quakes.slice(0, 20),
            correlations: {
              solar_temp: correlate(solar, temp),
              lunar_temp: correlate(lunar, temp),
              seismic_pressure: correlate(seismic, pressure),
              seismic_temp: correlate(seismic, temp),
            },
            moon_today: moonPhase(new Date().toISOString().slice(0, 10)),
            generated_at: new Date().toISOString(),
          });
          CACHE.set(key, { at: Date.now(), body });
          return new Response(body, {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
          });
        } catch (error) {
          console.error("astro feed failed", error);
          return Response.json({ error: "astro inputs unavailable" }, { status: 503 });
        }
      }
    }
  }
}
