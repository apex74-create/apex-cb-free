import { createFileRoute } from "@tanstack/react-router";
import { arrayCells, nearbyArray, recordFieldReport } from "@/lib/field-array.server";

/**
 * Field array ingest and read-out.
 *
 * POST — one station reporting what it can measure. Position is rounded to a
 * coarse cell before storage and no device or account identifier is recorded.
 * GET  — the aggregate picture: nearby means when lat/lon are supplied,
 *        otherwise the live cell list.
 *
 * Public by design: a station has no account. Everything written is coarse and
 * everything read is an average, so there is nothing here worth abusing.
 */

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function text(v: unknown, max = 32): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}

export const Route = createFileRoute("/api/public/field-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "body must be JSON" }, { status: 400 });
        }
        const lat = num(body["lat"], -90, 90);
        const lon = num(body["lon"], -180, 180);
        if (lat === null || lon === null) {
          return Response.json({ error: "lat and lon are required" }, { status: 400 });
        }
        try {
          await recordFieldReport({
            lat,
            lon,
            pressure: num(body["pressure"], 800, 1100),
            pressure_trend: num(body["pressure_trend"], -30, 30),
            temp_f: num(body["temp_f"], -80, 140),
            signal_score: num(body["signal_score"], 0, 100),
            link_type: text(body["link_type"], 16),
            downlink: num(body["downlink"], 0, 10000),
            rtt_ms: num(body["rtt_ms"], 0, 60000),
            jitter_ms: num(body["jitter_ms"], 0, 60000),
            device_class: text(body["device_class"], 16),
            app_version: text(body["app_version"], 24),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "report failed" },
            { status: 503 },
          );
        }
        return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const minutes = Number(url.searchParams.get("minutes") ?? "180");
        const window = Number.isFinite(minutes) ? Math.max(5, Math.min(minutes, 1440)) : 180;
        const latRaw = url.searchParams.get("lat");
        const lonRaw = url.searchParams.get("lon");
        try {
          if (latRaw !== null && lonRaw !== null) {
            const lat = num(latRaw, -90, 90);
            const lon = num(lonRaw, -180, 180);
            if (lat === null || lon === null) {
              return Response.json({ error: "lat and lon must be numbers" }, { status: 400 });
            }
            const radius = num(url.searchParams.get("radius"), 0.05, 5) ?? 0.75;
            return Response.json(
              { nearby: await nearbyArray(lat, lon, radius, window) },
              { headers: { "Cache-Control": "public, max-age=60" } },
            );
          }
          return Response.json(
            { cells: await arrayCells(window, 200), minutes: window },
            { headers: { "Cache-Control": "public, max-age=60" } },
          );
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "array unavailable" },
            { status: 503 },
          );
        }
      },
    },
  },
});
