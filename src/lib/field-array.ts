/**
 * Field sensor array — device side.
 *
 * Turns this device into a station. It gathers what the browser will actually
 * give us — barometer and tendency from the on-device sweep, link type,
 * throughput estimate and round-trip time from the network, a coarse position —
 * scores the radio, and posts it to the array.
 *
 * Deliberately coarse and deliberately anonymous: the position is rounded to
 * two decimals here, before it leaves the device, and nothing identifying is
 * sent. Contributing is a setting the user can switch off.
 *
 * Browser only.
 */

import { sweepDevice, type SensorReading } from "@/lib/device-sensors";

const OPT_KEY = "apex.fieldArray.optIn";
const LAST_KEY = "apex.fieldArray.lastSent";
const MIN_GAP_MS = 10 * 60 * 1000;

export type DeviceClass = "watch" | "phone" | "tablet" | "desktop";

export type FieldReport = {
  lat: number;
  lon: number;
  pressure: number | null;
  pressure_trend: number | null;
  temp_f: number | null;
  signal_score: number | null;
  link_type: string | null;
  downlink: number | null;
  rtt_ms: number | null;
  device_class: DeviceClass;
  app_version: string;
};

export function contributionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPT_KEY) !== "off";
  } catch {
    return false;
  }
}

export function setContribution(on: boolean) {
  try {
    window.localStorage.setItem(OPT_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked — the setting just will not persist */
  }
}

function deviceClass(): DeviceClass {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const min = Math.min(w, h);
  if (min <= 480 && Math.max(w, h) <= 640) return "watch";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (!coarse) return "desktop";
  return min >= 600 ? "tablet" : "phone";
}

type NetInfo = { effectiveType?: string; downlink?: number; rtt?: number; type?: string };

function netInfo(): NetInfo {
  const nav = navigator as unknown as { connection?: NetInfo };
  return nav.connection ?? {};
}

/**
 * Radio quality, 0 (unusable) to 100 (clean). Built from throughput and
 * latency because those are the two things a browser can honestly see.
 * This is the "wardrive" half of the array: when a storm cell sits over a
 * neighbourhood, the scores in that cell fall, and that is itself a signal.
 */
export function signalScore(info: NetInfo): number | null {
  const down = typeof info.downlink === "number" ? info.downlink : null;
  const rtt = typeof info.rtt === "number" ? info.rtt : null;
  if (down === null && rtt === null) return null;
  // 10 Mbps or better is a full throughput mark; 50 ms or less is full latency.
  const throughput = down === null ? 0.5 : Math.max(0, Math.min(1, down / 10));
  const latency = rtt === null ? 0.5 : Math.max(0, Math.min(1, 1 - (rtt - 50) / 950));
  return Math.round((throughput * 0.55 + latency * 0.45) * 100);
}

function coarseFix(timeoutMs = 8000): Promise<{ lat: number; lon: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { lat: number; lon: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    window.setTimeout(() => done(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        done({
          // Rounded here, on the device, before anything is sent.
          lat: Number(pos.coords.latitude.toFixed(2)),
          lon: Number(pos.coords.longitude.toFixed(2)),
        }),
      () => done(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    );
  });
}

export const APP_VERSION = "1.0.0";

/** Build a report without sending it — used by the array page to show its own row. */
export async function buildFieldReport(fallback?: {
  lat: number;
  lon: number;
  sweep?: SensorReading | null;
}): Promise<FieldReport | null> {
  const fix =
    (await coarseFix()) ??
    (fallback ? { lat: Number(fallback.lat.toFixed(2)), lon: Number(fallback.lon.toFixed(2)) } : null);
  if (!fix) return null;
  const sweep = fallback?.sweep ?? (await sweepDevice().catch(() => null));
  const info = netInfo();
  return {
    lat: fix.lat,
    lon: fix.lon,
    pressure: sweep?.pressure ?? null,
    pressure_trend: sweep?.trend ?? null,
    temp_f: sweep?.temp ?? null,
    signal_score: signalScore(info),
    link_type: info.effectiveType ?? info.type ?? null,
    downlink: typeof info.downlink === "number" ? info.downlink : null,
    rtt_ms: typeof info.rtt === "number" ? Math.round(info.rtt) : null,
    device_class: deviceClass(),
    app_version: APP_VERSION,
  };
}

/**
 * Send one report. Silently does nothing when the user has opted out, when the
 * device is offline, or when one was sent in the last ten minutes.
 */
export async function sendFieldReport(fallback?: {
  lat: number;
  lon: number;
  sweep?: SensorReading | null;
}): Promise<FieldReport | null> {
  if (typeof window === "undefined" || !contributionEnabled()) return null;
  if (navigator.onLine === false) return null;
  try {
    const last = Number(window.localStorage.getItem(LAST_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < MIN_GAP_MS) return null;
  } catch {
    /* storage blocked — send anyway */
  }
  const report = await buildFieldReport(fallback);
  if (!report) return null;
  try {
    const res = await fetch("/api/public/field-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) return null;
    try {
      window.localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    return report;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ read */

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

export async function fetchArrayCells(minutes = 180, signal?: AbortSignal): Promise<ArrayCell[]> {
  const res = await fetch(`/api/public/field-report?minutes=${minutes}`, signal ? { signal } : {});
  if (!res.ok) throw new Error("array unavailable");
  const json = (await res.json()) as { cells?: ArrayCell[] };
  return json.cells ?? [];
}

export async function fetchNearbyArray(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<NearbyArray | null> {
  const res = await fetch(
    `/api/public/field-report?lat=${lat}&lon=${lon}&radius=0.75&minutes=180`,
    signal ? { signal } : {},
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { nearby?: NearbyArray };
  return json.nearby ?? null;
}

/** Plain-language read of a signal score. */
export function signalLabel(score: number | null): string {
  if (score === null) return "unknown";
  if (score >= 80) return "clean";
  if (score >= 60) return "good";
  if (score >= 40) return "degraded";
  if (score >= 20) return "poor";
  return "struggling";
}
