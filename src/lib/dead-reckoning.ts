/**
 * Inertial dead reckoning — keep a walker's pin moving when satellites drop.
 *
 * Under heavy canopy or in a ravine the GNSS fix goes stale or vanishes. The
 * handset's accelerometer still sees every footfall, and the compass (or, on
 * panels with no magnetometer, the last course over ground) still gives a
 * bearing. Counting steps and projecting the last trusted fix forward keeps a
 * teammate's marker roughly where they actually are instead of frozen at the
 * spot where the trees closed in.
 *
 * This never overrides a live fix. The moment a fresh GPS position arrives the
 * estimate re-seeds to it and the accumulated drift is thrown away.
 *
 * Browser only: reads `devicemotion`. Degrades to "no steps" everywhere else.
 */

export type StepDetectorOptions = {
  /** Low-pass smoothing factor for the gravity estimate (0..1, higher = slower). */
  gravityAlpha: number;
  /** Acceleration swing (m/s^2) that counts as a footfall. */
  threshold: number;
  /** Minimum gap between footfalls (ms). Blocks double counting one step. */
  refractoryMs: number;
  /** Weinberg stride constant; stride = k * (aMax - aMin)^(1/4). */
  strideK: number;
  /** Clamp for the derived stride, metres. */
  minStride: number;
  maxStride: number;
};

export const DEFAULT_STEP_OPTIONS: StepDetectorOptions = {
  gravityAlpha: 0.9,
  threshold: 1.6,
  refractoryMs: 280,
  strideK: 0.51,
  minStride: 0.4,
  maxStride: 1.0,
};

export type Step = { at: number; stride: number };

export type StepDetector = {
  /** Feed one accelerometer magnitude sample (m/s^2, gravity included). */
  push: (magnitude: number, at: number) => Step | null;
  count: () => number;
  reset: () => void;
};

/**
 * Peak/valley footfall detector. Tracks the swing between the high and low of
 * each stride and uses Weinberg's fourth-root rule to size it: a hard, fast
 * stride swings more and covers more ground than a careful stalk.
 */
export function createStepDetector(options: Partial<StepDetectorOptions> = {}): StepDetector {
  const o = { ...DEFAULT_STEP_OPTIONS, ...options };
  let gravity = 9.81;
  let primed = false;
  let lastStepAt = 0;
  let hi = -Infinity;
  let lo = Infinity;
  let above = false;
  let steps = 0;

  const reset = () => {
    gravity = 9.81;
    primed = false;
    lastStepAt = 0;
    hi = -Infinity;
    lo = Infinity;
    above = false;
    steps = 0;
  };

  const push = (magnitude: number, at: number): Step | null => {
    if (!Number.isFinite(magnitude) || !Number.isFinite(at)) return null;
    gravity = o.gravityAlpha * gravity + (1 - o.gravityAlpha) * magnitude;
    const linear = magnitude - gravity;

    if (!primed) {
      primed = true;
      hi = linear;
      lo = linear;
      return null;
    }

    if (linear > hi) hi = linear;
    if (linear < lo) lo = linear;

    // Rising edge through the threshold closes one stride cycle.
    if (!above && linear > o.threshold / 2) {
      above = true;
      const swing = hi - lo;
      hi = linear;
      lo = linear;
      if (swing < o.threshold) return null;
      if (at - lastStepAt < o.refractoryMs) return null;
      lastStepAt = at;
      steps += 1;
      const stride = Math.min(o.maxStride, Math.max(o.minStride, o.strideK * Math.pow(swing, 0.25)));
      return { at, stride };
    }
    if (above && linear < -o.threshold / 4) above = false;
    return null;
  };

  return { push, count: () => steps, reset };
}

const EARTH_R = 6_371_000;

/** Move a coordinate `dist` metres along `bearing` degrees from north. */
export function projectPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  dist: number,
): { lat: number; lon: number } {
  const r = Math.PI / 180;
  const d = dist / EARTH_R;
  const b = bearingDeg * r;
  const la1 = lat * r;
  const lo1 = lon * r;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 =
    lo1 +
    Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return { lat: la2 / r, lon: ((lo2 / r + 540) % 360) - 180 };
}

/**
 * Growth of the uncertainty ring while running on footsteps alone. Roughly 12%
 * of the distance walked (heading error dominates), on top of the accuracy of
 * the fix we seeded from.
 */
export function driftRadius(seedAcc: number, walkedM: number): number {
  return seedAcc + walkedM * 0.12 + 3;
}

export type DeadReckonState = {
  lat: number;
  lon: number;
  acc: number;
  /** "gps" while a fresh fix drives the pin, "inertial" while stepping blind. */
  source: "gps" | "inertial";
  steps: number;
  /** Metres walked since the last trusted fix. */
  walked: number;
};

export type DeadReckoner = {
  /** A trusted satellite/network fix: re-seed and drop accumulated drift. */
  fix: (lat: number, lon: number, acc: number, at: number) => void;
  /** One footfall with a bearing (degrees from north, null = unknown). */
  step: (stride: number, bearing: number | null) => void;
  state: () => DeadReckonState | null;
  reset: () => void;
};

export function createDeadReckoner(): DeadReckoner {
  let s: DeadReckonState | null = null;
  let seedAcc = 50;

  return {
    fix(lat, lon, acc) {
      seedAcc = acc;
      s = { lat, lon, acc, source: "gps", steps: s ? s.steps : 0, walked: 0 };
    },
    step(stride, bearing) {
      if (!s || bearing === null || !Number.isFinite(bearing)) return;
      const next = projectPoint(s.lat, s.lon, bearing, stride);
      const walked = s.walked + stride;
      s = {
        lat: next.lat,
        lon: next.lon,
        acc: driftRadius(seedAcc, walked),
        source: "inertial",
        steps: s.steps + 1,
        walked,
      };
    },
    state: () => s,
    reset() {
      s = null;
      seedAcc = 50;
    },
  };
}

/** Ask Android/iOS for motion access. Resolves true when samples may flow. */
export async function requestMotionAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const ctor = window.DeviceMotionEvent as
    | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  if (!ctor) return false;
  if (typeof ctor.requestPermission !== "function") return true;
  try {
    return (await ctor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}
