/**
 * Web permission matrix + companion control.
 *
 * The watch WebView now has every site permission granted, so the browser
 * itself becomes a hardware bus: WebHID for companion pucks, Web Serial /
 * USB for boards, Bluetooth for BLE beacons, geolocation + sensors for the
 * fix. This module enumerates what the running browser actually exposes,
 * drives the permission prompts, and solves a trilateration fix from the
 * RSSI of whatever companions answered.
 *
 * Everything here is real browser API surface — no simulated devices.
 */

export type PermState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export type PermRow = {
  key: string;
  label: string;
  /** Permissions API descriptor name, when one exists. */
  name?: PermissionName | string;
  /** Capability probe: is the API present at all? */
  supported: () => boolean;
  /** Optional explicit request path (Permissions API cannot request). */
  request?: () => Promise<void>;
  group: "sensor" | "device" | "media" | "net" | "system";
};

const has = (path: string) => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as unknown as Record<string, unknown>;
  return (
    path
      .split(".")
      .reduce<unknown>((o, k) => (o ? (o as Record<string, unknown>)[k] : undefined), nav) != null
  );
};

const win = (k: string) => typeof window !== "undefined" && k in window;

export const PERMISSIONS: PermRow[] = [
  {
    key: "geolocation",
    label: "Geolocation",
    name: "geolocation",
    group: "sensor",
    supported: () => has("geolocation"),
    request: () =>
      new Promise<void>((res, rej) =>
        navigator.geolocation.getCurrentPosition(
          () => res(),
          (e) => rej(new Error(e.message)),
          {
            enableHighAccuracy: true,
            timeout: 12000,
          },
        ),
      ),
  },
  {
    key: "accelerometer",
    label: "Motion / accelerometer",
    name: "accelerometer",
    group: "sensor",
    supported: () => win("DeviceMotionEvent") || win("Accelerometer"),
    request: async () => {
      const dm = (
        window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }
      ).DeviceMotionEvent;
      if (dm?.requestPermission) {
        const r = await dm.requestPermission();
        if (r !== "granted") throw new Error(r);
      }
    },
  },
  {
    key: "magnetometer",
    label: "Magnetometer / compass",
    name: "magnetometer",
    group: "sensor",
    supported: () => win("Magnetometer") || win("DeviceOrientationEvent"),
  },
  {
    key: "ambient-light-sensor",
    label: "Ambient light",
    name: "ambient-light-sensor",
    group: "sensor",
    supported: () => win("AmbientLightSensor"),
  },
  {
    key: "camera",
    label: "Camera",
    name: "camera",
    group: "media",
    supported: () => has("mediaDevices.getUserMedia"),
    request: async () => {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
    },
  },
  {
    key: "microphone",
    label: "Microphone",
    name: "microphone",
    group: "media",
    supported: () => has("mediaDevices.getUserMedia"),
    request: async () => {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    },
  },
  {
    key: "notifications",
    label: "Notifications",
    name: "notifications",
    group: "system",
    supported: () => win("Notification"),
    request: async () => {
      const r = await Notification.requestPermission();
      if (r !== "granted") throw new Error(r);
    },
  },
  {
    key: "clipboard-read",
    label: "Clipboard read",
    name: "clipboard-read",
    group: "system",
    supported: () => has("clipboard.readText"),
  },
  {
    key: "persistent-storage",
    label: "Persistent storage",
    name: "persistent-storage",
    group: "system",
    supported: () => has("storage.persist"),
    request: async () => {
      const ok = await navigator.storage.persist();
      if (!ok) throw new Error("refused");
    },
  },
  {
    key: "hid",
    label: "WebHID (companion)",
    group: "device",
    supported: () => has("hid"),
    request: async () => {
      await requestHid();
    },
  },
  {
    key: "serial",
    label: "Web Serial",
    group: "device",
    supported: () => has("serial"),
    request: async () => {
      await (
        navigator as unknown as { serial: { requestPort: () => Promise<unknown> } }
      ).serial.requestPort();
    },
  },
  {
    key: "usb",
    label: "WebUSB",
    group: "device",
    supported: () => has("usb"),
    request: async () => {
      await (
        navigator as unknown as { usb: { requestDevice: (o: unknown) => Promise<unknown> } }
      ).usb.requestDevice({
        filters: [],
      });
    },
  },
  {
    key: "bluetooth",
    label: "Web Bluetooth",
    group: "device",
    supported: () => has("bluetooth"),
    request: async () => {
      await (
        navigator as unknown as { bluetooth: { requestDevice: (o: unknown) => Promise<unknown> } }
      ).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [] });
    },
  },
  {
    key: "nfc",
    label: "Web NFC",
    group: "net",
    supported: () => win("NDEFReader"),
    request: async () => {
      const R = (window as unknown as { NDEFReader: new () => { scan: () => Promise<void> } })
        .NDEFReader;
      await new R().scan();
    },
  },
  {
    key: "wake-lock",
    label: "Screen wake lock",
    name: "screen-wake-lock",
    group: "system",
    supported: () => has("wakeLock"),
    request: async () => {
      const l = await (
        navigator as unknown as {
          wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        }
      ).wakeLock.request("screen");
      await l.release();
    },
  },
  {
    key: "network",
    label: "Network information",
    group: "net",
    supported: () => has("connection"),
  },
  {
    key: "battery",
    label: "Battery status",
    group: "system",
    supported: () => has("getBattery"),
    request: async () => {
      await (navigator as unknown as { getBattery: () => Promise<unknown> }).getBattery();
    },
  },
];

/** Reads current state through the Permissions API where the descriptor exists. */
export async function readState(row: PermRow): Promise<PermState> {
  if (!row.supported()) return "unsupported";
  if (!row.name || !has("permissions.query")) return "unknown";
  try {
    const s = await navigator.permissions.query({ name: row.name as PermissionName });
    return s.state as PermState;
  } catch {
    return "unknown";
  }
}

export async function readAll(): Promise<Record<string, PermState>> {
  const out: Record<string, PermState> = {};
  await Promise.all(
    PERMISSIONS.map(async (r) => {
      out[r.key] = await readState(r);
    }),
  );
  return out;
}

/* ----------------------------- WebHID companion ---------------------------- */

type HIDDeviceLike = {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  collections: { usagePage: number; usage: number }[];
  open: () => Promise<void>;
  close: () => Promise<void>;
  sendReport: (id: number, data: BufferSource) => Promise<void>;
  addEventListener: (t: string, fn: (e: { reportId: number; data: DataView }) => void) => void;
  removeEventListener: (t: string, fn: (e: { reportId: number; data: DataView }) => void) => void;
};

type HIDLike = {
  getDevices: () => Promise<HIDDeviceLike[]>;
  requestDevice: (o: { filters: unknown[] }) => Promise<HIDDeviceLike[]>;
};

const hid = (): HIDLike | null =>
  typeof navigator !== "undefined" && "hid" in navigator
    ? (navigator as unknown as { hid: HIDLike }).hid
    : null;

export type Companion = {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  usage: string;
  opened: boolean;
  /** Last input-report derived signal strength proxy, in dBm. */
  rssi: number | null;
  reports: number;
  device: HIDDeviceLike;
};

const idOf = (d: HIDDeviceLike) =>
  `${d.vendorId.toString(16).padStart(4, "0")}:${d.productId.toString(16).padStart(4, "0")}`;

function wrap(d: HIDDeviceLike): Companion {
  const c = d.collections?.[0];
  return {
    id: idOf(d),
    name: d.productName || "HID device",
    vendorId: d.vendorId,
    productId: d.productId,
    usage: c ? `page 0x${c.usagePage.toString(16)} / usage 0x${c.usage.toString(16)}` : "—",
    opened: d.opened,
    rssi: null,
    reports: 0,
    device: d,
  };
}

/** Devices this origin was already granted (survives reloads). */
export async function listHid(): Promise<Companion[]> {
  const h = hid();
  if (!h) return [];
  return (await h.getDevices()).map(wrap);
}

/** Opens the browser chooser — the only way to gain a new HID grant. */
export async function requestHid(): Promise<Companion[]> {
  const h = hid();
  if (!h) throw new Error("WebHID unavailable in this browser");
  return (await h.requestDevice({ filters: [] })).map(wrap);
}

export async function openCompanion(c: Companion): Promise<void> {
  if (!c.device.opened) await c.device.open();
}

export async function closeCompanion(c: Companion): Promise<void> {
  if (c.device.opened) await c.device.close();
}

/** Sends a raw output report — the companion-control path (LED, haptics, mode). */
export async function sendReport(c: Companion, reportId: number, bytes: number[]): Promise<void> {
  await openCompanion(c);
  await c.device.sendReport(reportId, new Uint8Array(bytes));
}

/**
 * Subscribes to input reports. The first byte of most companion telemetry
 * reports is a link-quality/battery byte; we surface it as a dBm proxy so the
 * trilateration solver has a real, device-sourced range input.
 */
export function watchCompanion(
  c: Companion,
  onReport: (r: { reportId: number; bytes: number[]; rssi: number }) => void,
): () => void {
  const fn = (e: { reportId: number; data: DataView }) => {
    const bytes: number[] = [];
    for (let i = 0; i < e.data.byteLength; i++) bytes.push(e.data.getUint8(i));
    const q = bytes[0] ?? 0;
    onReport({ reportId: e.reportId, bytes, rssi: -30 - (255 - q) * (70 / 255) });
  };
  c.device.addEventListener("inputreport", fn);
  void openCompanion(c);
  return () => c.device.removeEventListener("inputreport", fn);
}

/* ----------------------------- Trilateration ------------------------------ */

export type Anchor = { id: string; x: number; y: number; rssi: number };

/** Log-distance path loss: d = 10^((measured - rssi) / (10 n)). */
export const rssiToMetres = (rssi: number, measured = -45, n = 2.4) =>
  Math.pow(10, (measured - rssi) / (10 * n));

export type Fix = { x: number; y: number; radius: number; anchors: number };

/* -------- Solo Mode: Self-validation & Point Man Reference -------- */

/** Point man reference node for solo mode positioning. */
export type PointMan = {
  id: string;
  x: number;
  y: number;
  timestamp: number;
  bearing?: number;
};

/** Geometric validation result for signal markers. */
export type GeometricValidation = {
  isValid: boolean;
  geometryQuality: number; // 0-1 GDOP-derived anchor spread quality (1 = ideal)
  gdop: number; // Geometric dilution of precision (lower is better, >=1)
  bearingConsistency: number; // 0-1: how evenly bearings are distributed
  radiusVariance: number; // 0-1: lower is more consistent
  score: number; // Overall 0-1 confidence from geometry
};

/**
 * Validate anchor geometry around a fix using GDOP (geometric dilution of precision).
 *
 * Unit line-of-sight vectors from the fix to each anchor form the design matrix H;
 * GDOP = sqrt(trace((HᵀH)⁻¹)). The theoretical best for n anchors in 2D is 2/sqrt(n),
 * so quality = bestGdop / gdop gives 1.0 for an ideal, evenly-spread ring of anchors
 * (an equidistant square scores 1.0, a collinear set scores ~0).
 */
export function validateGeometry(anchors: Anchor[], fix: Fix): GeometricValidation {
  if (anchors.length < 3) {
    return {
      isValid: false,
      geometryQuality: 0,
      gdop: Infinity,
      bearingConsistency: 0,
      radiusVariance: 1,
      score: 0,
    };
  }

  // Distances from fix to each anchor vs. what RSSI predicts.
  const distances = anchors.map((a) => Math.hypot(fix.x - a.x, fix.y - a.y));
  const radiusExpected = anchors.map((a) => rssiToMetres(a.rssi));

  const radiusDiffs = distances.map(
    (d, i) => Math.abs(d - radiusExpected[i]!) / Math.max(d, radiusExpected[i]!, 1),
  );
  const radiusVariance = Math.min(1, radiusDiffs.reduce((a, b) => a + b, 0) / radiusDiffs.length);

  // Bearings from the fix to each anchor (skip anchors sitting on top of the fix).
  const bearings: number[] = [];
  for (let i = 0; i < anchors.length; i++) {
    if (distances[i]! < 1e-9) continue;
    bearings.push(Math.atan2(anchors[i]!.y - fix.y, anchors[i]!.x - fix.x));
  }

  // GDOP from the 2x2 normal matrix HᵀH of unit line-of-sight vectors.
  let gdop = Infinity;
  let geometryQuality = 0;
  if (bearings.length >= 3) {
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const b of bearings) {
      const ux = Math.cos(b);
      const uy = Math.sin(b);
      sxx += ux * ux;
      sxy += ux * uy;
      syy += uy * uy;
    }
    const det = sxx * syy - sxy * sxy;
    if (det > 1e-9) {
      // trace of the inverse = (sxx + syy) / det
      gdop = Math.sqrt((sxx + syy) / det);
      const bestGdop = 2 / Math.sqrt(bearings.length);
      geometryQuality = Math.max(0, Math.min(1, bestGdop / gdop));
    }
  }

  // Bearing consistency: how evenly the anchors ring the fix (sorted angular gaps).
  let bearingConsistency = 0;
  if (bearings.length >= 3) {
    const sorted = [...bearings].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = i === sorted.length - 1 ? sorted[0]! + Math.PI * 2 : sorted[i + 1]!;
      gaps.push(next - sorted[i]!);
    }
    const ideal = (Math.PI * 2) / gaps.length;
    const spread =
      gaps.reduce((acc, g) => acc + Math.abs(g - ideal), 0) / gaps.length / (Math.PI * 2);
    bearingConsistency = Math.max(0, Math.min(1, 1 - spread * 2));
  }

  // Overall score: 45% spread geometry, 30% bearing evenness, 25% radius agreement.
  const score = Math.max(
    0,
    Math.min(1, geometryQuality * 0.45 + bearingConsistency * 0.3 + (1 - radiusVariance) * 0.25),
  );

  return {
    isValid: score > 0.3,
    geometryQuality,
    gdop,
    bearingConsistency,
    radiusVariance,
    score,
  };
}

/** Self-validation check: validate device's own position fix using geometric rules. */
export function validateSelfPosition(
  selfAnchor: Anchor,
  remoteAnchors: Anchor[],
  selfFix: Fix,
): GeometricValidation {
  // Include self as first anchor
  const allAnchors = [selfAnchor, ...remoteAnchors];
  return validateGeometry(allAnchors, selfFix);
}

/**
 * Least-squares trilateration over 3+ anchors, linearised against the first
 * anchor. Returns the solved position plus a residual radius (accuracy).
 */
export function trilaterate(anchors: Anchor[]): Fix | null {
  if (anchors.length < 3) return null;
  const a0 = anchors[0]!;
  const r0 = rssiToMetres(a0.rssi);
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i]!;
    const ri = rssiToMetres(a.rssi);
    rows.push([2 * (a.x - a0.x), 2 * (a.y - a0.y)]);
    rhs.push(r0 * r0 - ri * ri + a.x * a.x - a0.x * a0.x + a.y * a.y - a0.y * a0.y);
  }
  // Normal equations for the 2x2 system.
  let s11 = 0,
    s12 = 0,
    s22 = 0,
    t1 = 0,
    t2 = 0;
  rows.forEach((r, i) => {
    s11 += r[0]! * r[0]!;
    s12 += r[0]! * r[1]!;
    s22 += r[1]! * r[1]!;
    t1 += r[0]! * rhs[i]!;
    t2 += r[1]! * rhs[i]!;
  });
  const det = s11 * s22 - s12 * s12;
  if (Math.abs(det) < 1e-9) return null;
  const x = (t1 * s22 - t2 * s12) / det;
  const y = (s11 * t2 - s12 * t1) / det;
  const residual =
    anchors.reduce((acc, a) => {
      const d = Math.hypot(x - a.x, y - a.y);
      return acc + Math.abs(d - rssiToMetres(a.rssi));
    }, 0) / anchors.length;
  return { x, y, radius: residual, anchors: anchors.length };
}
