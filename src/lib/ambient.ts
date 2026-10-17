/**
 * Ambient signal sensing — no ADB bridge, no agent, no permissions beyond the
 * ones the user grants in the browser itself.
 *
 * The point: the surrounding signal environment is observable from inside a
 * page. We are not fingerprinting devices; we collect the ambient picture:
 *
 *   1. ICE harvest  — WebRTC candidate gathering reports this device's local
 *                     interface addresses, mDNS (.local / Bonjour) identifiers
 *                     that the browser mints for them, and the server-reflexive
 *                     address a STUN server sees. That gives us the LAN subnet,
 *                     interface count, NAT type and whether mDNS is live.
 *   2. Carrier read  — Network Information API: bearer type, effective class,
 *                     downlink estimate, round-trip estimate, data saver.
 *   3. Hop timing    — the three static index pages (/x/a,b,c) are fetched and
 *                     timed. Spread across hops is a real measure of the local
 *                     link, and Resource Timing gives per-phase numbers.
 *   4. Position      — geolocation fix + accuracy. Accuracy is itself a signal
 *                     reading: a tight fix means many APs/satellites heard.
 *   5. Platform      — battery, motion sensors present, cores, memory class.
 *
 * Every field is nullable. Nothing is synthesised: a sensor the browser refuses
 * is reported as unavailable, never as a fake number.
 */

export type IceHost = {
  /** address as reported: IPv4, IPv6, or an mDNS <uuid>.local name */
  address: string;
  kind: "lan" | "mdns" | "ipv6" | "public";
  protocol: string | null;
};

export type AmbientIce = {
  hosts: IceHost[];
  publicAddress: string | null;
  subnets: string[];
  mdns: boolean;
  natType: "open" | "nat" | "blocked" | "unknown";
  error: string | null;
};

export type AmbientCarrier = {
  type: string | null;
  effective: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean | null;
  online: boolean;
};

export type AmbientHop = {
  name: string;
  url: string;
  ms: number | null;
  bytes: number | null;
  error: string | null;
};

export type AmbientFix = {
  lat: number;
  lon: number;
  accuracyM: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  at: number;
} | null;

export type AmbientPlatform = {
  cores: number | null;
  memoryGb: number | null;
  batteryPct: number | null;
  charging: boolean | null;
  motion: boolean;
  orientation: boolean;
  secureContext: boolean;
};

export type AmbientSample = {
  at: number;
  ice: AmbientIce;
  carrier: AmbientCarrier;
  hops: AmbientHop[];
  jitterMs: number | null;
  fix: AmbientFix;
  platform: AmbientPlatform;
};

/* ---- 1. ICE harvest ---------------------------------------------------- */

const STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:global.stun.twilio.com:3478",
];

const PRIVATE_V4 = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;

function classify(address: string): IceHost["kind"] {
  if (address.endsWith(".local")) return "mdns";
  if (address.includes(":")) return "ipv6";
  if (PRIVATE_V4.test(address)) return "lan";
  return "public";
}

/** Gather ICE candidates. Resolves when gathering completes or the budget ends. */
export async function harvestIce(timeoutMs = 3500): Promise<AmbientIce> {
  const empty: AmbientIce = {
    hosts: [],
    publicAddress: null,
    subnets: [],
    mdns: false,
    natType: "unknown",
    error: null,
  };
  if (typeof RTCPeerConnection === "undefined") {
    return { ...empty, error: "WebRTC unavailable in this browser" };
  }

  let pc: RTCPeerConnection;
  try {
    pc = new RTCPeerConnection({ iceServers: [{ urls: STUN }] });
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "peer connection blocked" };
  }

  const seen = new Map<string, IceHost>();
  let publicAddress: string | null = null;
  let sawSrflx = false;

  const done = new Promise<void>((resolve) => {
    const finish = () => resolve();
    const timer = setTimeout(finish, timeoutMs);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        finish();
      }
    };
    pc.onicecandidate = (event) => {
      const c = event.candidate;
      if (!c) {
        clearTimeout(timer);
        finish();
        return;
      }
      // `address` is the modern field; the candidate string is the fallback.
      const raw =
        c.address ?? /(?:candidate:\S+ \d+ \S+ \d+ )(\S+)/.exec(c.candidate ?? "")?.[1] ?? null;
      if (!raw) return;
      const kind = classify(raw);
      if (c.type === "srflx" || c.type === "prflx") {
        sawSrflx = true;
        if (kind === "public") publicAddress = raw;
      }
      if (!seen.has(raw)) {
        seen.set(raw, { address: raw, kind, protocol: c.protocol ?? null });
      }
    };
  });

  try {
    // A data channel is enough to trigger a full host-candidate gather.
    pc.createDataChannel("ambient");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  } catch (err) {
    try {
      pc.close();
    } catch {
      /* already closed */
    }
    return { ...empty, error: err instanceof Error ? err.message : "ICE gather failed" };
  }

  await done;
  try {
    pc.close();
  } catch {
    /* already closed */
  }

  const hosts = [...seen.values()];
  const subnets = [
    ...new Set(
      hosts.filter((h) => h.kind === "lan").map((h) => h.address.split(".").slice(0, 3).join(".")),
    ),
  ];
  const hasLan = hosts.some((h) => h.kind === "lan");

  return {
    hosts,
    publicAddress,
    subnets,
    mdns: hosts.some((h) => h.kind === "mdns"),
    natType: sawSrflx
      ? hasLan && publicAddress
        ? "nat"
        : "open"
      : hosts.length
        ? "unknown"
        : "blocked",
    error: hosts.length ? null : "no candidates gathered",
  };
}

/* ---- 2. Carrier read --------------------------------------------------- */

type NetInfo = {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (t: string, fn: () => void) => void;
  removeEventListener?: (t: string, fn: () => void) => void;
};

function netInfo(): NetInfo | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: NetInfo };
  return nav.connection ?? null;
}

export function readCarrier(): AmbientCarrier {
  const c = netInfo();
  return {
    type: c?.type ?? null,
    effective: c?.effectiveType ?? null,
    downlinkMbps: typeof c?.downlink === "number" ? c.downlink : null,
    rttMs: typeof c?.rtt === "number" ? c.rtt : null,
    saveData: typeof c?.saveData === "boolean" ? c.saveData : null,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  };
}

/* ---- 3. Hop timing over the three static index pages ------------------- */

export const HOPS: { name: string; url: string }[] = [
  { name: "A", url: "/x/a.html" },
  { name: "B", url: "/x/b.html" },
  { name: "C", url: "/x/c.html" },
];

export async function timeHops(): Promise<{ hops: AmbientHop[]; jitterMs: number | null }> {
  const hops: AmbientHop[] = [];
  for (const hop of HOPS) {
    const started = performance.now();
    try {
      const res = await fetch(`${hop.url}?t=${Date.now()}`, { cache: "no-store" });
      const body = await res.text();
      hops.push({
        name: hop.name,
        url: hop.url,
        ms: Math.round(performance.now() - started),
        bytes: body.length,
        error: res.ok ? null : `HTTP ${res.status}`,
      });
    } catch (err) {
      hops.push({
        name: hop.name,
        url: hop.url,
        ms: null,
        bytes: null,
        error: err instanceof Error ? err.message : "unreachable",
      });
    }
  }
  const times = hops.map((h) => h.ms).filter((n): n is number => n !== null);
  if (times.length < 2) return { hops, jitterMs: null };
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
  return { hops, jitterMs: Math.round(Math.sqrt(variance)) };
}

/* ---- 4. Position ------------------------------------------------------- */

export function readFix(timeoutMs = 8000): Promise<AmbientFix> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          altitudeM: pos.coords.altitude ?? null,
          speedMps: pos.coords.speed ?? null,
          headingDeg: pos.coords.heading ?? null,
          at: pos.timestamp,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 },
    );
  });
}

/* ---- 5. Platform ------------------------------------------------------- */

export async function readPlatform(): Promise<AmbientPlatform> {
  const nav =
    typeof navigator === "undefined"
      ? null
      : (navigator as Navigator & {
          deviceMemory?: number;
          getBattery?: () => Promise<{ level: number; charging: boolean }>;
        });

  let batteryPct: number | null = null;
  let charging: boolean | null = null;
  try {
    const battery = await nav?.getBattery?.();
    if (battery) {
      batteryPct = Math.round(battery.level * 100);
      charging = battery.charging;
    }
  } catch {
    /* battery access denied */
  }

  return {
    cores: nav?.hardwareConcurrency ?? null,
    memoryGb: nav?.deviceMemory ?? null,
    batteryPct,
    charging,
    motion: typeof window !== "undefined" && "DeviceMotionEvent" in window,
    orientation: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
    secureContext: typeof window !== "undefined" && window.isSecureContext,
  };
}

/* ---- Full sample ------------------------------------------------------- */

export async function sampleAmbient(opts: { fix?: boolean } = {}): Promise<AmbientSample> {
  const [ice, hopResult, fix, platform] = await Promise.all([
    harvestIce(),
    timeHops(),
    opts.fix === false ? Promise.resolve(null) : readFix(),
    readPlatform(),
  ]);
  return {
    at: Date.now(),
    ice,
    carrier: readCarrier(),
    hops: hopResult.hops,
    jitterMs: hopResult.jitterMs,
    fix,
    platform,
  };
}

/** Human-readable one-line summary used by the panel header and exports. */
export function summarise(s: AmbientSample): string {
  const bits: string[] = [];
  bits.push(
    s.carrier.effective
      ? s.carrier.effective.toUpperCase()
      : s.carrier.online
        ? "ONLINE"
        : "OFFLINE",
  );
  if (s.ice.subnets.length) bits.push(`LAN ${s.ice.subnets[0]}.0/24`);
  if (s.ice.mdns) bits.push("MDNS");
  if (s.jitterMs !== null) bits.push(`±${s.jitterMs}ms`);
  if (s.fix) bits.push(`FIX ±${Math.round(s.fix.accuracyM ?? 0)}m`);
  return bits.join(" · ");
}
