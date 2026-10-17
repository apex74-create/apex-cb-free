import { createFileRoute } from "@tanstack/react-router";
import { buildConditions, conditionsQuery, type OpenMeteo } from "@/lib/conditions-normalize";

export { describeWeatherCode } from "@/lib/conditions-normalize";

/**
 * Live conditions endpoint — observations only.
 *
 * This is the "now" layer of the weather app: current readings, the next 24
 * hours, and a seven day daily strip. It carries NO engine output; the wave
 * collapse synthesis stays in /api/public/forecast. Keeping them separate lets
 * the live layer refresh every minute without re-running the engine.
 */

type Cached = { at: number; payload: unknown };
const cache = new Map<string, Cached>();
const TTL_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 6 * 60 * 60 * 1000;

function coord(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > max) return fallback;
  return parsed;
}

export const Route = createFileRoute("/api/public/conditions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = coord(url.searchParams.get("lat"), 44.98, 90);
        const lon = coord(url.searchParams.get("lon"), -84.6, 180);
        // ~11 km buckets: neighbours share one upstream call, so the feed limit is hit far less.
        const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;

        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) {
          return Response.json(hit.payload, {
            headers: { "cache-control": "public, max-age=60" },
          });
        }

        try {
          // Source chain: Open-Meteo first, MET Norway second — never one point of failure.
          let payload: unknown;
          try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?${conditionsQuery(lat, lon)}`, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(7000),
            });
            if (!res.ok) throw new Error(`open-meteo ${res.status}`);
            payload = buildConditions((await res.json()) as OpenMeteo, lat, lon);
          } catch {
            const { metNoUrl, buildFromMetNo } = await import("@/lib/conditions-metno");
            const res = await fetch(metNoUrl(lat, lon), {
              headers: { Accept: "application/json", "User-Agent": "TinyRadr/1.0 https://tinyradr.lovable.app" },
              signal: AbortSignal.timeout(7000),
            });
            if (!res.ok) throw new Error(`all feeds down (met.no ${res.status})`);
            payload = buildFromMetNo(await res.json(), lat, lon);
          }

          cache.set(key, { at: Date.now(), payload });
          return Response.json(payload, { headers: { "cache-control": "public, max-age=60" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "conditions unavailable";
          if (hit && Date.now() - hit.at < STALE_MAX_MS) {
            return Response.json(hit.payload, {
              headers: { "cache-control": "public, max-age=30", "x-stale": "1" },
            });
          }
          // Tell the handset to fetch the feed itself instead of showing a hard failure.
          return Response.json({ error: message, fallback: "handset" }, {
            status: 503,
            headers: { "retry-after": "60", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
