/**
 * LOKMAT background biometric harvesting.
 *
 * Everything here reads real device output over the ADB bridge:
 *   - `dumpsys sensorservice`  — sensor inventory + last delivered event values
 *   - `logcat -d`              — vendor sensor-hub / health-service chatter
 *   - `content query`          — vendor health provider rows when exposed
 *
 * Nothing is generated locally. If the watch does not publish a channel the
 * reading is simply absent.
 */

export type BioKind = "hr" | "spo2" | "bp" | "temp" | "steps" | "offbody" | "hrv" | "stress";

export type BioReading = {
  kind: BioKind;
  value: number;
  /** Diastolic for blood pressure, otherwise undefined. */
  value2?: number;
  unit: string;
  /** epoch ms when this app observed the line (logcat carries no year). */
  at: number;
  /** raw source line for audit */
  raw: string;
  source: "sensorservice" | "logcat" | "provider";
};

export type SensorEntry = {
  name: string;
  vendor: string;
  stringType: string;
  handle: string;
  /** last event payload if the dump carried one */
  last?: number[];
  bio: BioKind | null;
};

export const BIO_LABEL: Record<BioKind, string> = {
  hr: "heart rate",
  spo2: "blood oxygen",
  bp: "blood pressure",
  temp: "body temp",
  steps: "step count",
  offbody: "off-body",
  hrv: "hrv",
  stress: "stress",
};

export const BIO_UNIT: Record<BioKind, string> = {
  hr: "bpm",
  spo2: "%",
  bp: "mmHg",
  temp: "°C",
  steps: "steps",
  offbody: "",
  hrv: "ms",
  stress: "",
};

/** Plausibility gates — vendor logs leak raw ADC counts we must not show. */
const RANGE: Record<BioKind, [number, number]> = {
  hr: [25, 240],
  spo2: [50, 100],
  bp: [40, 260],
  temp: [20, 45],
  steps: [0, 200000],
  offbody: [0, 1],
  hrv: [5, 400],
  stress: [0, 100],
};

function inRange(kind: BioKind, v: number): boolean {
  const [lo, hi] = RANGE[kind];
  return Number.isFinite(v) && v >= lo && v <= hi;
}

/** Map an android/vendor sensor string type onto a biometric channel. */
export function classifySensor(stringType: string, name: string): BioKind | null {
  const s = `${stringType} ${name}`.toLowerCase();
  if (/heart[_ ]?rate|heartrate|\bhrs\b|hrs3300|ppg/.test(s) && !/variab|hrv/.test(s)) return "hr";
  if (/hrv|rr[_ ]?interval|heart.?rate.?variab/.test(s)) return "hrv";
  if (/spo2|oxygen|blood[_ ]?ox|oximet/.test(s)) return "spo2";
  if (/blood[_ ]?press|\bbpm?_?press|\bbp[_ ]/.test(s)) return "bp";
  if (/body[_ ]?temp|skin[_ ]?temp|ambient[_ ]?temperature|thermom|\btemperature\b/.test(s))
    return "temp";
  if (/step[_ ]?counter|step[_ ]?detect|pedometer/.test(s)) return "steps";
  if (/offbody|off[_ ]body|wear[_ ]?detect|on[_ ]?body/.test(s)) return "offbody";
  if (/stress|fatigue/.test(s)) return "stress";
  return null;
}

/**
 * Parse `dumpsys sensorservice`. Handles both the classic
 * `0x00000001) Heart Rate Sensor | Vendor | ... ` inventory block and the
 * `Sensor List:` / `last 10 events` sections that carry live values.
 */
export function parseSensorService(dump: string): SensorEntry[] {
  const out: SensorEntry[] = [];
  const seen = new Set<string>();
  const lines = dump.split("\n");

  for (const line of lines) {
    // 0x0000000d) Heart Rate Sensor        | Vendor Corp | ver: 1 | type: android.sensor.heart_rate(21)
    const m = line.match(/^\s*(0x[0-9a-f]+)\)\s*([^|]+)\|([^|]*)\|(.*)$/i);
    if (!m) continue;
    const handle = m[1] ?? "";
    const name = (m[2] ?? "").trim();
    const vendor = (m[3] ?? "").trim();
    const tail = m[4] ?? "";
    const st = tail.match(/type:\s*([\w.]+)/i);
    const stringType = st?.[1] ?? "";
    const key = `${handle}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ handle, name, vendor, stringType, bio: classifySensor(stringType, name) });
  }

  /* attach the most recent event payload per handle when present:
     "  0x0000000d: 12345678 72.0, 0.0, 0.0" */
  for (const line of lines) {
    const m = line.match(/^\s*(0x[0-9a-f]+):\s*[\d.]+\s+((?:-?\d+(?:\.\d+)?\s*,?\s*){1,6})$/i);
    if (!m) continue;
    const handle = m[1] ?? "";
    const vals = (m[2] ?? "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
    const entry = out.find((e) => e.handle.toLowerCase() === handle.toLowerCase());
    if (entry && vals.length && !entry.last) entry.last = vals;
  }

  return out;
}

/** Readings derived from a sensorservice dump (only for classified channels). */
export function readingsFromSensors(entries: SensorEntry[], at = Date.now()): BioReading[] {
  const out: BioReading[] = [];
  for (const e of entries) {
    if (!e.bio || !e.last?.length) continue;
    const v = e.last[0] ?? NaN;
    if (!inRange(e.bio, v)) continue;
    out.push({
      kind: e.bio,
      value: v,
      unit: BIO_UNIT[e.bio],
      at,
      raw: `${e.name} ${e.last.join(", ")}`,
      source: "sensorservice",
    });
  }
  return out;
}

/**
 * Scrape a logcat buffer for background biometric measurements. Vendor
 * sensor-hub daemons on LOKMAT/APPLLP builds log lines such as:
 *   D/HeartRateService: onSensorChanged hr=72
 *   I/hrs3300 : ppg heart rate: 68 bpm
 *   D/BpAlgo  : sbp=118 dbp=76
 *   I/SpO2    : spo2 value = 97
 */
export function parseLogcatBio(text: string, at = Date.now()): BioReading[] {
  const out: BioReading[] = [];
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const low = l.toLowerCase();

    // blood pressure first — it carries two numbers
    const bp =
      low.match(/\b(?:sbp|systolic)\D{0,8}(\d{2,3})\D{0,20}?(?:dbp|diastolic)\D{0,8}(\d{2,3})/) ??
      low.match(/\bbp\b\D{0,6}(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (bp) {
      const sys = Number(bp[1]);
      const dia = Number(bp[2]);
      if (inRange("bp", sys) && inRange("bp", dia) && sys > dia) {
        out.push({
          kind: "bp",
          value: sys,
          value2: dia,
          unit: "mmHg",
          at,
          raw: l,
          source: "logcat",
        });
        continue;
      }
    }

    const grab = (re: RegExp): number | null => {
      const m = low.match(re);
      return m ? Number(m[1]) : null;
    };

    const hr = grab(/\b(?:heart[_ ]?rate|heartrate|\bhr\b|bpm)\D{0,10}?(\d{2,3}(?:\.\d+)?)/);
    if (hr !== null && inRange("hr", hr)) {
      out.push({ kind: "hr", value: hr, unit: "bpm", at, raw: l, source: "logcat" });
      continue;
    }

    const spo2 = grab(/\b(?:spo2|oxygen|blood[_ ]?ox)\D{0,10}?(\d{2,3}(?:\.\d+)?)/);
    if (spo2 !== null && inRange("spo2", spo2)) {
      out.push({ kind: "spo2", value: spo2, unit: "%", at, raw: l, source: "logcat" });
      continue;
    }

    const temp = grab(
      /\b(?:body[_ ]?temp|skin[_ ]?temp|temperature|temp)\D{0,10}?(\d{2}(?:\.\d+)?)/,
    );
    if (temp !== null && inRange("temp", temp)) {
      out.push({ kind: "temp", value: temp, unit: "°C", at, raw: l, source: "logcat" });
      continue;
    }

    const hrv = grab(/\b(?:hrv|rmssd|rr[_ ]?interval)\D{0,10}?(\d{2,3}(?:\.\d+)?)/);
    if (hrv !== null && inRange("hrv", hrv)) {
      out.push({ kind: "hrv", value: hrv, unit: "ms", at, raw: l, source: "logcat" });
      continue;
    }

    const steps = grab(/\bstep(?:s|[_ ]?count(?:er)?)\D{0,10}?(\d{1,6})/);
    if (steps !== null && inRange("steps", steps)) {
      out.push({ kind: "steps", value: steps, unit: "steps", at, raw: l, source: "logcat" });
    }
  }
  return out;
}

/** Keep the newest reading per channel. */
export function latestByKind(readings: BioReading[]): Partial<Record<BioKind, BioReading>> {
  const map: Partial<Record<BioKind, BioReading>> = {};
  for (const r of readings) {
    const prev = map[r.kind];
    if (!prev || r.at >= prev.at) map[r.kind] = r;
  }
  return map;
}

/** Vendor packages known to own the health pipeline on LOKMAT builds. */
export const HEALTH_PACKAGE_HINTS = [
  "health",
  "heart",
  "sport",
  "fit",
  "lokmat",
  "sensorhub",
  "wear",
];

/** logcat tag filter used for the background sweep (real vendor tags). */
export const BIO_LOGCAT_TAGS = [
  "HeartRate",
  "HeartRateService",
  "hrs3300",
  "HRS",
  "PPG",
  "SpO2",
  "Spo2",
  "BpAlgo",
  "BloodPressure",
  "SensorHub",
  "sensors-hal",
  "HealthService",
  "Temperature",
];

/**
 * Command deck for the biometric sweep. Each entry is a real adb invocation.
 * `parse` marks what the route does with the output.
 */
export const BIO_COMMANDS = {
  sensorList: "shell dumpsys sensorservice",
  logcatDump: `shell logcat -d -v time -t 600`,
  logcatBio: `shell logcat -d -v time -t 2000 | grep -iE "heart|hr=|bpm|ppg|spo2|oxygen|blood|sbp|dbp|temp|hrv|sensorhub" | tail -120`,
  sensorPackages: "shell pm list packages | grep -iE 'health|heart|sport|fit|lokmat|wear'",
  sensorProps: "shell getprop | grep -iE 'sensor|health|hrs|ppg'",
  batteryTemp: "shell dumpsys battery | grep -i temperature",
  wakeup: "shell dumpsys sensorservice | grep -iE 'heart|ppg|spo2|temp|step'",
} as const;

/** Battery thermal is a real on-device temperature channel (deci-°C). */
export function parseBatteryTemp(dump: string): number | null {
  const m = dump.match(/temperature:\s*(-?\d+)/i);
  if (!m) return null;
  const c = Number(m[1]) / 10;
  return Number.isFinite(c) ? c : null;
}
