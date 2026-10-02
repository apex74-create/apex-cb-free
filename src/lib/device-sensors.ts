/**
 * On-device atmospheric sweep.
 *
 * Some phones, tablets and watches carry a real barometer and, less often, an
 * ambient thermometer. Where they exist they describe the air at this exact
 * spot, which a gridded public observation a few miles away cannot. This module
 * reads them, keeps a short rolling history so a three-hour pressure tendency
 * can be derived, and hands the result to the forecast as an optional weight.
 *
 * Everything here degrades to nothing. No sensor, no permission, no support:
 * the sweep reports "unavailable" and the forecast runs exactly as before.
 *
 * Browser only. Never import this from a loader or a server function.
 */

export type SweepSource = "barometer" | "thermometer" | "network";

export type SensorReading = {
  /** Station pressure in hPa. */
  pressure: number | null;
  /** Ambient temperature in F. */
  temp: number | null;
  /** Pressure change in hPa over the last three hours, derived locally. */
  trend: number | null;
  /** Relative light level, used only as a daylight sanity flag. */
  light: number | null;
  sources: SweepSource[];
  takenAt: number;
};

export type SweepStatus = "unsupported" | "denied" | "idle" | "reading" | "ready";

const HISTORY_KEY = "apex.sensorSweep.history";
const HISTORY_MS = 6 * 60 * 60 * 1000;
const THREE_HOURS = 3 * 60 * 60 * 1000;

type Sample = { t: number; p: number };

function readHistory(): Sample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - HISTORY_MS;
    return parsed
      .filter(
        (s): s is Sample =>
          !!s &&
          typeof (s as Sample).t === "number" &&
          typeof (s as Sample).p === "number" &&
          (s as Sample).t > cutoff,
      )
      .slice(-240);
  } catch {
    return [];
  }
}

function writeHistory(samples: Sample[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(samples.slice(-240)));
  } catch {
    /* storage blocked — the sweep still works, just without a tendency */
  }
}

/** hPa change over roughly the last three hours, or null without enough history. */
function tendency(samples: Sample[]): number | null {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1];
  if (!last) return null;
  const target = last.t - THREE_HOURS;
  // Oldest sample at or before the three-hour mark; otherwise the oldest we have.
  let base: Sample | undefined;
  for (const s of samples) {
    if (s.t <= target) base = s;
  }
  if (!base) base = samples[0];
  if (!base || base === last) return null;
  const spanHours = (last.t - base.t) / 3_600_000;
  if (spanHours < 0.5) return null;
  // Normalise to a three-hour rate so a short history is not over-read.
  const rate = ((last.p - base.p) / spanHours) * 3;
  return Number(Math.max(-30, Math.min(30, rate)).toFixed(2));
}

type GenericSensor = {
  start: () => void;
  stop: () => void;
  addEventListener: (type: string, fn: () => void) => void;
};

function sensorCtor(name: string): (new (opts: { frequency: number }) => GenericSensor) | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as Record<string, unknown>)[name];
  return typeof ctor === "function"
    ? (ctor as new (opts: { frequency: number }) => GenericSensor)
    : null;
}

export function sweepSupported(): boolean {
  return !!(sensorCtor("Barometer") || sensorCtor("AmbientLightSensor"));
}

/** Read one sensor once, resolving to null when it is missing or blocked. */
function readOnce(name: string, field: string, timeoutMs = 2500): Promise<number | null> {
  const Ctor = sensorCtor(name);
  if (!Ctor) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      try {
        sensor.stop();
      } catch {
        /* already stopped */
      }
      resolve(v);
    };
    let sensor: GenericSensor;
    try {
      sensor = new Ctor({ frequency: 1 });
    } catch {
      resolve(null);
      return;
    }
    sensor.addEventListener("reading", () => {
      const v = (sensor as unknown as Record<string, unknown>)[field];
      done(typeof v === "number" && Number.isFinite(v) ? v : null);
    });
    sensor.addEventListener("error", () => done(null));
    window.setTimeout(() => done(null), timeoutMs);
    try {
      sensor.start();
    } catch {
      done(null);
    }
  });
}

/**
 * Take a full sweep. Records the pressure sample so the tendency improves the
 * longer the app has been used on this device.
 */
export async function sweepDevice(): Promise<SensorReading> {
  const [pressure, light] = await Promise.all([
    readOnce("Barometer", "pressure"),
    readOnce("AmbientLightSensor", "illuminance"),
  ]);

  const sources: SweepSource[] = [];
  let trend: number | null = null;

  if (typeof pressure === "number") {
    sources.push("barometer");
    const samples = readHistory();
    samples.push({ t: Date.now(), p: pressure });
    writeHistory(samples);
    trend = tendency(samples);
  }

  return {
    pressure,
    temp: null,
    trend,
    light,
    sources,
    takenAt: Date.now(),
  };
}

/** Query-string fragment for the forecast endpoint. Empty when nothing was read. */
export function sweepParams(reading: SensorReading | null): Record<string, string> {
  if (!reading) return {};
  const out: Record<string, string> = {};
  if (typeof reading.pressure === "number") out["sensor_pressure"] = reading.pressure.toFixed(1);
  if (typeof reading.trend === "number") out["sensor_trend"] = reading.trend.toFixed(2);
  if (typeof reading.temp === "number") out["sensor_temp"] = reading.temp.toFixed(1);
  return out;
}
