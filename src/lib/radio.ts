/**
 * Radio Lab — the fine-grain radio/GNSS controls that AOSP 10 hides behind
 * the hidden RadioInfo activity (the *#*#4636#*#* "Testing" menu). Every
 * entry here is a real `adb shell` command; nothing is simulated.
 */

export type RadioAction = {
  key: string;
  label: string;
  sub: string;
  cmd: string;
  /** Actions that change radio state need a confirm tap. */
  risky?: boolean;
};

export type RadioGroup = {
  key: string;
  title: string;
  note: string;
  actions: RadioAction[];
};

/** AOSP `preferred_network_mode` values that exist on Android 10. */
export const NETWORK_MODES: { value: number; label: string }[] = [
  { value: 0, label: "WCDMA pref" },
  { value: 1, label: "GSM only" },
  { value: 2, label: "WCDMA only" },
  { value: 3, label: "GSM / WCDMA auto" },
  { value: 9, label: "LTE + GSM/WCDMA" },
  { value: 11, label: "LTE only" },
  { value: 12, label: "LTE / WCDMA" },
  { value: 17, label: "LTE / WCDMA / GSM" },
  { value: 22, label: "Global auto" },
];

export const modeCmd = (mode: number) =>
  `settings put global preferred_network_mode ${mode}; settings put global preferred_network_mode1 ${mode}; settings get global preferred_network_mode`;

export const RADIO_GROUPS: RadioGroup[] = [
  {
    key: "hidden",
    title: "Hidden menus",
    note: "Launches the stock AOSP radio screens on the phone/watch display.",
    actions: [
      {
        key: "radioinfo",
        label: "RadioInfo",
        sub: "com.android.settings/.RadioInfo",
        cmd: "am start -n com.android.settings/.RadioInfo",
      },
      {
        key: "testing",
        label: "Testing menu",
        sub: "dialer *#*#4636#*#*",
        cmd: "am start -a android.intent.action.DIAL -d 'tel:*%23*%234636%23*%23*'",
      },
      {
        key: "gnssinfo",
        label: "GNSS diag",
        sub: "settings gnss debug screen",
        cmd: "am start -n com.android.settings/.Settings\\$LocationSettingsActivity",
      },
      {
        key: "fielddiag",
        label: "Field test",
        sub: "MTK EngineerMode (LOKMAT SoC)",
        cmd: "am start -n com.mediatek.engineermode/.EngineerMode",
      },
    ],
  },
  {
    key: "power",
    title: "Radio power",
    note: "Cycles the modem the same way RadioInfo's radio-power switch does.",
    actions: [
      {
        key: "data-on",
        label: "Data ON",
        sub: "svc data enable",
        cmd: "svc data enable",
        risky: true,
      },
      {
        key: "data-off",
        label: "Data OFF",
        sub: "svc data disable",
        cmd: "svc data disable",
        risky: true,
      },
      {
        key: "apm-on",
        label: "Airplane ON",
        sub: "cmd connectivity airplane-mode enable",
        cmd: "cmd connectivity airplane-mode enable",
        risky: true,
      },
      {
        key: "apm-off",
        label: "Airplane OFF",
        sub: "cmd connectivity airplane-mode disable",
        cmd: "cmd connectivity airplane-mode disable",
        risky: true,
      },
    ],
  },
  {
    key: "gnss",
    title: "GNSS / AGPS",
    note: "Location engine controls — the receiver-level knobs behind the GPS icon.",
    actions: [
      {
        key: "loc-on",
        label: "Location ON",
        sub: "cmd location set-location-enabled true",
        cmd: "cmd location set-location-enabled true",
      },
      {
        key: "gnss-metrics",
        label: "GNSS metrics",
        sub: "dumpsys location --gnssmetrics",
        cmd: "dumpsys location --gnssmetrics",
      },
      {
        key: "agps-reload",
        label: "Re-arm AGPS",
        sub: "broadcast NETWORK_SET_TIMEZONE + provider kick",
        cmd: "cmd location providers set-test-provider-enabled gps true 2>/dev/null; dumpsys location | head -n 40",
      },
      {
        key: "sats",
        label: "Satellites",
        sub: "last GNSS status block",
        cmd: "dumpsys location | grep -iE 'satellite|gnss|last location' | head -n 30",
      },
    ],
  },
  {
    key: "cells",
    title: "Cell / band survey",
    note: "Raw serving-cell and neighbour reports straight out of the telephony registry.",
    actions: [
      {
        key: "cellinfo",
        label: "Cell info",
        sub: "dumpsys telephony.registry (cells)",
        cmd: "dumpsys telephony.registry | grep -iE 'CellIdentity|CellSignalStrength|mCellInfo' | head -n 40",
      },
      {
        key: "servicestate",
        label: "Service state",
        sub: "registration, band, roaming",
        cmd: "dumpsys telephony.registry | grep -iE 'mServiceState|DisplayInfo|DataNetworkType' | head -n 20",
      },
      {
        key: "signal",
        label: "Signal detail",
        sub: "rsrp / rsrq / sinr",
        cmd: "dumpsys telephony.registry | grep -iE 'SignalStrength|rsrp|rsrq|rssnr|ss=' | head -n 20",
      },
      {
        key: "carrier",
        label: "Carrier props",
        sub: "getprop gsm.*",
        cmd: "getprop | grep -iE 'gsm\\.|ril\\.|persist\\.radio' | head -n 40",
      },
    ],
  },
  {
    key: "kernel",
    title: "Kernel / modem",
    note: "Build + kernel level readouts for the modem stack on this SKU.",
    actions: [
      {
        key: "modem",
        label: "Modem build",
        sub: "getprop gsm.version.baseband",
        cmd: "getprop gsm.version.baseband; getprop ro.build.fingerprint",
      },
      {
        key: "ril",
        label: "RIL log",
        sub: "logcat -d -b radio (tail)",
        cmd: "logcat -d -b radio -t 60",
      },
      {
        key: "kmsg",
        label: "Kernel radio",
        sub: "dmesg | grep radio/gps",
        cmd: "dmesg 2>/dev/null | grep -iE 'gps|gnss|modem|ril' | tail -n 40",
      },
      { key: "ifaces", label: "Interfaces", sub: "ip -o addr", cmd: "ip -o addr" },
    ],
  },
];

/** Parses `key: value` / `key=value` pairs out of any of the readouts above. */
export function parseRadioRows(raw: string): [string, string][] {
  const rows: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^\[?([\w.$ -]+?)\]?\s*[:=]\s*\[?(.+?)\]?$/);
    if (m) rows.push([m[1]!.slice(0, 42), m[2]!.slice(0, 120)]);
    else rows.push([t.slice(0, 80), ""]);
    if (rows.length >= 60) break;
  }
  return rows;
}

/** Pulls a dBm-ish number out of a signal blob so the gauge has something real. */
export function pickDbm(raw: string): number | null {
  const m = raw.match(/(?:rsrp|ss|rssi)\s*[=:]\s*(-?\d{2,3})/i);
  if (m) return Number(m[1]);
  const any = raw.match(/(-\d{2,3})\s*dBm/i);
  return any ? Number(any[1]) : null;
}
