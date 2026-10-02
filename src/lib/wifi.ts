/**
 * Wi-Fi state off the bridge.
 *
 * Two real device reads:
 *   `dumpsys wifi`               -> the current association (SSID/BSSID/RSSI/speed/IP)
 *   `cmd wifi list-scan-results` -> every AP the radio can currently hear
 *
 * Nothing is synthesised: when the radio reports nothing, the panel stays blank.
 */

export const WIFI_STATE_CMD = "shell dumpsys wifi | head -60";
export const WIFI_SCAN_CMD = "shell cmd wifi list-scan-results";
export const WIFI_START_SCAN_CMD = "shell cmd wifi start-scan";

export type WifiLink = {
  enabled: boolean | null;
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  speedMbps: number | null;
  freqMhz: number | null;
  ip: string | null;
};

export type WifiAp = {
  ssid: string;
  bssid: string | null;
  rssi: number | null;
  freqMhz: number | null;
  flags: string | null;
};

const clean = (s: string | undefined): string | null => {
  if (!s) return null;
  const v = s.trim().replace(/^"|"$/g, "").trim();
  if (!v || v === "<unknown ssid>" || v === "null" || v === "none") return null;
  return v;
};

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function parseWifiState(out: string): WifiLink {
  const enabled = /Wi-?Fi is enabled/i.test(out)
    ? true
    : /Wi-?Fi is disabled/i.test(out)
      ? false
      : null;

  return {
    enabled,
    ssid: clean(/\bSSID:\s*([^,\n]+)/i.exec(out)?.[1]),
    bssid: clean(/\bBSSID:\s*([0-9a-f:]{17}|[^,\n]+)/i.exec(out)?.[1]),
    rssi: num(/\bRSSI:\s*(-?\d+)/i.exec(out)?.[1]),
    speedMbps: num(/Link speed:\s*(\d+)/i.exec(out)?.[1]),
    freqMhz: num(/Frequency:\s*(\d+)/i.exec(out)?.[1]),
    ip: clean(/(?:IP|ip_address)\s*:?\s*(\d+\.\d+\.\d+\.\d+)/i.exec(out)?.[1]),
  };
}

/**
 * `cmd wifi list-scan-results` prints a header row then one AP per line:
 *   BSSID              Frequency  RSSI  Age(sec)  SSID           Flags
 * Column order is stable across Android 10-14, but the SSID may contain
 * spaces, so flags are taken from the trailing bracketed run.
 */
export function parseScanResults(out: string): WifiAp[] {
  const aps: WifiAp[] = [];
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    if (!line || /^BSSID/i.test(line) || /^Total/i.test(line)) continue;
    const m = /^([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+(\d{3,5})\s+(-?\d+)\s+(-?\d+)\s*(.*)$/i.exec(
      line,
    );
    if (!m) continue;
    const rest = m[5] ?? "";
    const flagsAt = rest.search(/\[/);
    const ssid = (flagsAt === -1 ? rest : rest.slice(0, flagsAt)).trim();
    aps.push({
      ssid: ssid || "(hidden)",
      bssid: m[1]!.toLowerCase(),
      freqMhz: num(m[2]),
      rssi: num(m[3]),
      flags: flagsAt === -1 ? null : rest.slice(flagsAt).trim(),
    });
  }
  // strongest first, de-duplicated per BSSID
  const seen = new Set<string>();
  return aps
    .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
    .filter((a) => (a.bssid && seen.has(a.bssid) ? false : (seen.add(a.bssid ?? a.ssid), true)));
}

export function bandOf(freq: number | null): string {
  if (!freq) return "?";
  if (freq >= 5925) return "6G";
  if (freq >= 4900) return "5G";
  return "2.4G";
}

/** -30 strong … -90 unusable, mapped to 0-4 bars. */
export function bars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}
