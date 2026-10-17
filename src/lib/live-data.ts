import { useEffect, useRef, useState } from "react";
import { useBridge } from "./bridge-hooks";

/* ---- Parsers over real `adb shell` output ----------------------------- */

export type AccessPoint = {
  bssid: string;
  ssid: string;
  freq: number;
  rssi: number;
  flags: string;
  /** Free-space-path-loss distance estimate in metres */
  distance: number;
};

/** Log-distance path loss, n=2.6 indoor-ish, ref -40 dBm @ 1 m. */
export function estimateDistance(rssi: number, freqMhz: number): number {
  const refDb = freqMhz > 4000 ? -44 : -40;
  return Math.max(0.5, Math.pow(10, (refDb - rssi) / (10 * 2.6)));
}

/** Parses `cmd wifi list-scan-results`. */
export function parseScanResults(raw: string): AccessPoint[] {
  const out: AccessPoint[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(
      /([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})\s+(\d{3,5})\s+(-?\d{1,3})[^\s]*\s+([\d.]+|-?\d+)\s*(.*)$/,
    );
    if (!m) continue;
    const [, bssid, freq, rssi, , rest = ""] = m;
    const flagIdx = rest.indexOf("[");
    const ssid = (flagIdx === -1 ? rest : rest.slice(0, flagIdx)).trim();
    out.push({
      bssid: bssid!,
      ssid: ssid || "<hidden>",
      freq: Number(freq),
      rssi: Number(rssi),
      flags: flagIdx === -1 ? "" : rest.slice(flagIdx).trim(),
      distance: estimateDistance(Number(rssi), Number(freq)),
    });
  }
  return out.sort((a, b) => b.rssi - a.rssi);
}

/** Parses `dumpsys battery`-style `key: value` blocks. */
export function parseKeyValues(raw: string): [string, string][] {
  const rows: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s{2,}([A-Za-z][\w .()-]*):\s*(.+?)\s*$/);
    if (m) rows.push([m[1]!.trim(), m[2]!]);
  }
  return rows;
}

/** Pulls the interesting lines out of `dumpsys telephony.registry`. */
export function parseTelephony(raw: string): [string, string][] {
  const want = [
    "mServiceState",
    "mSignalStrength",
    "mDataConnectionState",
    "mDataNetworkType",
    "mCellIdentity",
    "mTelephonyDisplayInfo",
  ];
  const rows: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const key = want.find((w) => line.includes(w));
    if (!key) continue;
    const value = line.split("=").slice(1).join("=").trim() || line.trim();
    rows.push([key.replace(/^m/, ""), value.slice(0, 160)]);
  }
  return rows;
}

/** Location providers + last known fixes from `dumpsys location`. */
export function parseLocation(raw: string): [string, string][] {
  const rows: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(gps|network|fused|passive):?\s+(.+)$/i);
    if (m) rows.push([m[1]!.toUpperCase(), m[2]!.slice(0, 120)]);
  }
  return rows;
}

/** Non-empty logcat lines, newest first. */
export function parseLines(raw: string): [string, string][] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-40)
    .reverse()
    .map((l) => {
      const m = l.match(/^(\S+\s+\S+)\s+(.*)$/);
      return [m ? m[2]!.slice(0, 90) : l.slice(0, 90), m ? m[1]! : ""] as [string, string];
    });
}

/* ---- Live polling ----------------------------------------------------- */

export type LiveState<T> = {
  data: T | null;
  raw: string;
  error: string | null;
  loading: boolean;
  at: number | null;
  refresh: () => void;
};

/**
 * Polls a real adb command through the bridge. There is no fallback data:
 * when the link is down the consumer gets an error and must say so.
 */
export function useLiveCommand<T>(
  cmd: string,
  parse: (raw: string) => T,
  intervalMs = 6000,
  enabled = true,
): LiveState<T> {
  const { run, state } = useBridge();
  const [data, setData] = useState<T | null>(null);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const busy = useRef(false);
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setData(null);
      setError("signal input disabled");
      setLoading(false);
      return;
    }
    if (state !== "online") {
      setError("no bridge link");
      setLoading(false);
      return;
    }

    const poll = async () => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      try {
        const output = await run(cmd);
        if (cancelled) return;
        setRaw(output);
        setData(parseRef.current(output));
        setError(null);
        setAt(Date.now());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "command failed");
      } finally {
        busy.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    void poll();
    const timer = intervalMs > 0 ? setInterval(poll, intervalMs) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [cmd, intervalMs, run, state, tick, enabled]);

  return { data, raw, error, loading, at, refresh: () => setTick((t) => t + 1) };
}
