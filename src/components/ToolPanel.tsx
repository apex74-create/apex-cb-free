import type { Tool } from "@/lib/tools";
import DoritoPanel from "./DoritoPanel";
import { useBridge } from "@/lib/bridge-hooks";
import {
  parseKeyValues,
  parseLines,
  parseLocation,
  parseScanResults,
  parseTelephony,
  useLiveCommand,
} from "@/lib/live-data";

type Feed = {
  cmd: string;
  parse: (raw: string) => [string, string][];
  interval: number;
  note: string;
};

/** Every panel is a real adb command on the paired phone. */
const FEEDS: Record<string, Feed> = {
  threat: {
    cmd: "shell logcat -d -t 60 -v brief *:W",
    parse: parseLines,
    interval: 5000,
    note: "Live warning/error logcat from the device. Nothing is generated locally.",
  },
  bruce: {
    cmd: "shell dumpsys battery",
    parse: parseKeyValues,
    interval: 8000,
    note: "Device power + charging state via dumpsys battery.",
  },
  tarwell: {
    cmd: "shell cmd wifi list-scan-results",
    parse: (raw) =>
      parseScanResults(raw).map((ap) => [
        `${ap.ssid} · ${ap.bssid.slice(-8)}`,
        `${ap.rssi} dBm · ~${ap.distance.toFixed(0)}m`,
      ]),
    interval: 8000,
    note: "Raw 802.11 scan results reported by the phone's Wi-Fi stack.",
  },
  dorito: {
    cmd: "shell dumpsys telephony.registry",
    parse: parseTelephony,
    interval: 8000,
    note: "Cellular service state, signal strength and cell identity.",
  },
  readme: {
    cmd: "shell dumpsys location",
    parse: parseLocation,
    interval: 10000,
    note: "Location providers and last known fixes. Authorised devices only.",
  },
};

export default function ToolPanel({ tool }: { tool: Tool }) {
  // Hooks must run unconditionally — the dorito early-return used to sit above
  // them, which desynced hook order between renders.
  const feed = FEEDS[tool.key] ?? FEEDS["readme"]!;
  const { state } = useBridge();
  const live = useLiveCommand(feed.cmd, feed.parse, feed.interval);
  const rows = live.data ?? [];

  if (tool.key === "dorito") return <DoritoPanel />;

  return (
    <div className="no-scrollbar absolute inset-0 overflow-y-auto scan-grid p-2 pb-8">
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="min-w-0 truncate text-[8px] uppercase tracking-widest text-muted-foreground">
          {feed.cmd}
        </span>
        <button
          type="button"
          onClick={live.refresh}
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          {live.loading ? "…" : "sync"}
        </button>
      </div>

      {live.error ? (
        <p className="rounded-sm border border-alert/50 bg-card/70 px-2 py-2 text-[9px] uppercase tracking-widest text-alert">
          no source · {live.error} · bridge {state}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-2 py-2 text-[9px] uppercase tracking-widest text-muted-foreground">
          {live.loading ? "reading device…" : "device returned no rows"}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(([label, value], i) => (
            <li
              key={`${label}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-border bg-card/70 px-2 py-2"
            >
              <span className="min-w-0 truncate text-[10px] uppercase tracking-widest text-foreground">
                {label}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{value}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
        {feed.note}
        {live.at ? ` · updated ${new Date(live.at).toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}
