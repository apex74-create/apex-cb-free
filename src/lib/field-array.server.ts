/**
 * Field sensor array — server side.
 *
 * Every running copy of the app is a station. It reports the air it can measure
 * (barometer, tendency, ambient temperature) and the radio it can see (link
 * type, throughput estimate, round-trip time, jitter) against a coarse grid
 * cell. Nothing here identifies a device, an account or a network: the position
 * is rounded before it leaves the phone and no identifier is stored.
 *
 * Reads go through SECURITY DEFINER aggregate functions, so raw rows are never
 * exposed — only counts and means per cell.
 *
 * Server only. Never import this from a component.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function client() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("backend is not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        // sb_ keys are opaque, not JWTs: send them as apikey only.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** ~1 km grid. Coarse on purpose: a cell, never a doorstep. */
export function gridCell(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export type FieldReportInput = {
  lat: number;
  lon: number;
  pressure?: number | null;
  pressure_trend?: number | null;
  temp_f?: number | null;
  signal_score?: number | null;
  link_type?: string | null;
  downlink?: number | null;
  rtt_ms?: number | null;
  jitter_ms?: number | null;
  device_class?: string | null;
  app_version?: string | null;
};

export async function recordFieldReport(input: FieldReportInput): Promise<void> {
  const lat = Number(input.lat.toFixed(2));
  const lon = Number(input.lon.toFixed(2));
  const { error } = await client()
    .from("field_reports")
    .insert({
      cell: gridCell(lat, lon),
      lat,
      lon,
      pressure: input.pressure ?? null,
      pressure_trend: input.pressure_trend ?? null,
      temp_f: input.temp_f ?? null,
      signal_score: input.signal_score ?? null,
      link_type: input.link_type ?? null,
      downlink: input.downlink ?? null,
      rtt_ms: input.rtt_ms ?? null,
      jitter_ms: input.jitter_ms ?? null,
      device_class: input.device_class ?? null,
      app_version: input.app_version ?? null,
    });
  if (error) throw new Error(error.message);
}

export type NearbyArray = {
  nodes: number;
  cells: number;
  pressure: number | null;
  pressure_trend: number | null;
  temp_f: number | null;
  signal_score: number | null;
  newest: string | null;
  radius_deg: number;
  minutes: number;
};

/** What the array is measuring around one point right now. */
export async function nearbyArray(
  lat: number,
  lon: number,
  radiusDeg = 0.75,
  minutes = 180,
): Promise<NearbyArray> {
  const { data, error } = await client().rpc("field_array_nearby", {
    _lat: lat,
    _lon: lon,
    _radius_deg: radiusDeg,
    _minutes: minutes,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    nodes: Number(row?.nodes ?? 0),
    cells: Number(row?.cells ?? 0),
    pressure: num(row?.pressure),
    pressure_trend: num(row?.pressure_trend),
    temp_f: num(row?.temp_f),
    signal_score: num(row?.signal_score),
    newest: row?.newest ?? null,
    radius_deg: radiusDeg,
    minutes,
  };
}

export type ArrayCell = {
  cell: string;
  lat: number;
  lon: number;
  nodes: number;
  pressure: number | null;
  pressure_trend: number | null;
  temp_f: number | null;
  signal_score: number | null;
  newest: string | null;
};

/** One row per live grid cell — the national picture. */
export async function arrayCells(minutes = 180, limit = 200): Promise<ArrayCell[]> {
  const { data, error } = await client().rpc("field_array_cells", {
    _minutes: minutes,
    _limit: limit,
  });
  if (error) throw new Error(error.message);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return (Array.isArray(data) ? data : []).map((row) => ({
    cell: String(row.cell),
    lat: Number(row.lat),
    lon: Number(row.lon),
    nodes: Number(row.nodes ?? 0),
    pressure: num(row.pressure),
    pressure_trend: num(row.pressure_trend),
    temp_f: num(row.temp_f),
    signal_score: num(row.signal_score),
    newest: row.newest ?? null,
  }));
}
