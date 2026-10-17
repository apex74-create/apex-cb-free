/**
 * Hardware inventory — everything here is read off the real device through
 * the adb bridge. Nothing is assumed from the model name, because LOKMAT
 * ships several different boards under the same product photo.
 */

/** One shot at the whole feature table; cheap and authoritative. */
export const featuresCmd = `shell pm list features`;
/** Board, model, Android build, radio firmware. */
export const propsCmd = `shell getprop`;
/** Bluetooth adapter state, address, name, supported profiles and LE limits. */
export const btCmd = `shell dumpsys bluetooth_manager`;
/** Which BT profiles actually have a service running. */
export const btProfilesCmd = `shell dumpsys activity services com.android.bluetooth 2>/dev/null | grep -Eo '[A-Za-z]+Service' | sort -u || echo ''`;
/** Total RAM. */
export const memCmd = `shell cat /proc/meminfo | head -3`;
/** User-visible storage. */
export const storageCmd = `shell df -h /data | tail -1`;
/** Wi-Fi band support as the driver reports it. */
export const wifiCmd = `shell cmd wifi status 2>/dev/null; shell dumpsys wifi | grep -iE 'band|5ghz|country' | head -8`;
/** SIM / radio detail. */
export const radioCmd = `shell getprop | grep -iE 'gsm.version|ril|radio|network.type' | head -12`;

export type Prop = Record<string, string>;

export function parseProps(out: string): Prop {
  const map: Prop = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]:\s*\[(.*)\]\s*$/);
    if (m) map[m[1]!] = m[2]!;
  }
  return map;
}

export function parseFeatures(out: string): string[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("feature:"))
    .map((l) => l.slice("feature:".length).split("=")[0]!.trim())
    .filter(Boolean);
}

export type BtInfo = {
  enabled: boolean | null;
  address: string;
  name: string;
  /** LE advertiser slots — >0 means the watch can act as a BLE peripheral. */
  multiAdvert: boolean | null;
  leExtendedAdvert: boolean | null;
  le2m: boolean | null;
  leCodedPhy: boolean | null;
  maxConnected: string;
  bondedCount: number | null;
};

const YES = /true|supported|1\b/i;

function flag(out: string, key: RegExp): boolean | null {
  const m = out.match(key);
  if (!m) return null;
  return YES.test(m[1] ?? "");
}

export function parseBluetooth(out: string): BtInfo {
  const state = out.match(/state:\s*(\w+)/i)?.[1] ?? out.match(/enabled:\s*(\w+)/i)?.[1] ?? "";
  return {
    enabled: state ? /^(on|true|STATE_ON)$/i.test(state) : null,
    address: out.match(/address:\s*([0-9A-F:]{17})/i)?.[1] ?? "",
    name: out.match(/name:\s*(.+)/i)?.[1]?.trim() ?? "",
    multiAdvert: flag(out, /isMultiAdvertisementSupported[^\S\n]*[:=]?\s*(\w+)/i),
    leExtendedAdvert: flag(out, /isLeExtendedAdvertisingSupported[^\S\n]*[:=]?\s*(\w+)/i),
    le2m: flag(out, /isLe2MPhySupported[^\S\n]*[:=]?\s*(\w+)/i),
    leCodedPhy: flag(out, /isLeCodedPhySupported[^\S\n]*[:=]?\s*(\w+)/i),
    maxConnected: out.match(/maxConnectedAudioDevices?[^\S\n]*[:=]?\s*(\d+)/i)?.[1] ?? "",
    bondedCount: (() => {
      const m = out.match(/Bonded devices:\s*(\d+)/i);
      return m ? Number(m[1]) : null;
    })(),
  };
}

export function parseProfiles(out: string): string[] {
  return [
    ...new Set(
      out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /Service$/.test(l)),
    ),
  ]
    .map((s) => s.replace(/Service$/, ""))
    .filter((s) => s.length > 1);
}

export function parseMemGb(out: string): string {
  const kb = Number(out.match(/MemTotal:\s*(\d+)/)?.[1] ?? 0);
  return kb ? `${(kb / 1024 / 1024).toFixed(1)} GB` : "";
}

export function parseStorage(out: string): string {
  const parts = out.trim().split(/\s+/);
  return parts.length >= 4 ? `${parts[2]} used / ${parts[1]}` : "";
}

/** Human rows built from the raw feature list — pure device truth. */
export type CapRow = { label: string; ok: boolean; note: string };

export function bluetoothCaps(features: string[], bt: BtInfo): CapRow[] {
  const has = (f: string) => features.includes(f);
  return [
    {
      label: "bluetooth classic",
      ok: has("android.hardware.bluetooth"),
      note: bt.address ? bt.address : "br/edr stack",
    },
    {
      label: "bluetooth le (gatt)",
      ok: has("android.hardware.bluetooth_le"),
      note: has("android.hardware.bluetooth_le") ? "central scans + gatt client" : "not exposed",
    },
    {
      label: "le peripheral / advertise",
      ok: bt.multiAdvert === true,
      note:
        bt.multiAdvert === null
          ? "adapter did not report advertiser slots"
          : bt.multiAdvert
            ? "can advertise as a peripheral"
            : "central only — cannot advertise",
    },
    {
      label: "le extended advertising",
      ok: bt.leExtendedAdvert === true,
      note: bt.leExtendedAdvert === null ? "not reported (pre-5.0 stack)" : "bt 5.0 extended pdu",
    },
    {
      label: "le 2m phy",
      ok: bt.le2m === true,
      note: bt.le2m === null ? "not reported" : "high speed le",
    },
    {
      label: "le coded phy",
      ok: bt.leCodedPhy === true,
      note: bt.leCodedPhy === null ? "not reported" : "long range le",
    },
  ];
}

export function radioCaps(features: string[]): CapRow[] {
  const has = (f: string) => features.includes(f);
  return [
    { label: "wifi", ok: has("android.hardware.wifi"), note: "station mode" },
    { label: "wifi direct", ok: has("android.hardware.wifi.direct"), note: "p2p group owner" },
    {
      label: "wifi aware",
      ok: has("android.hardware.wifi.aware"),
      note: "nan neighbour awareness",
    },
    { label: "wifi rtt", ok: has("android.hardware.wifi.rtt"), note: "802.11mc ranging" },
    { label: "telephony", ok: has("android.hardware.telephony"), note: "cellular modem" },
    { label: "lte", ok: has("android.hardware.telephony.lte"), note: "4g data" },
    { label: "gsm", ok: has("android.hardware.telephony.gsm"), note: "2g fallback" },
    { label: "nfc", ok: has("android.hardware.nfc"), note: "host card emulation if listed" },
    { label: "gps", ok: has("android.hardware.location.gps"), note: "gnss receiver" },
    { label: "sensor: compass", ok: has("android.hardware.sensor.compass"), note: "magnetometer" },
    { label: "sensor: barometer", ok: has("android.hardware.sensor.barometer"), note: "altitude" },
  ];
}
