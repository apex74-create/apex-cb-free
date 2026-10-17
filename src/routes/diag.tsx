import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import { parseScanResults } from "@/lib/live-data";
import { getMapStatus, subscribeMap, type MapStatus } from "@/lib/map-status";

export const Route = createFileRoute("/diag")({
  head: () => ({
    meta: [
      { title: "Apex Diagnostics — Scan, Permissions, Map" },
      {
        name: "description",
        content:
          "Live watch diagnostics: Wi-Fi scan permissions, scan throttling, scan activity, GPS providers, map render state and last refresh time — all read from the real device over the ADB bridge.",
      },
      { property: "og:title", content: "Apex Diagnostics" },
      {
        property: "og:description",
        content:
          "Wi-Fi scan permissions, scan activity, map rendering status and last refresh time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Diagnostics,
});

type Verdict = "ok" | "warn" | "fail" | "unknown";

type Check = {
  id: string;
  group: "permission" | "scan" | "map" | "link";
  label: string;
  verdict: Verdict;
  detail: string;
  raw?: string;
};

const TONE: Record<Verdict, string> = {
  ok: "text-signal border-signal/50",
  warn: "text-warn border-warn/50",
  fail: "text-alert border-alert/50",
  unknown: "text-muted-foreground border-border",
};

const MARK: Record<Verdict, string> = { ok: "●", warn: "▲", fail: "✕", unknown: "○" };

/** Package the shell runs as — grants for this uid gate `cmd wifi` scans. */
const SHELL_PKG = "com.android.shell";

const PERMS = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CHANGE_WIFI_STATE",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
];

function grantOf(dump: string, perm: string): boolean | null {
  const line = dump.split("\n").find((l) => l.includes(perm));
  if (!line) return null;
  if (/granted=true/.test(line)) return true;
  if (/granted=false/.test(line)) return false;
  return null;
}

function ago(at: number | null): string {
  if (!at) return "never";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function useMapStatus(): MapStatus {
  return useSyncExternalStore(subscribeMap, getMapStatus, getMapStatus);
}

function Diagnostics() {
  const { run, state, target, latency } = useBridge();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [, tick] = useState(0);
  const map = useMapStatus();
  const busy = useRef(false);

  /* keep the "x ago" readouts moving */
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const sweep = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setErr(null);
    const out: Check[] = [];

    const safe = async (cmd: string) => {
      try {
        return { ok: true as const, text: await run(cmd) };
      } catch (e) {
        return { ok: false as const, text: e instanceof Error ? e.message : "command failed" };
      }
    };

    try {
      /* ---- permissions ---- */
      const dump = await safe(`shell dumpsys package ${SHELL_PKG}`);
      if (!dump.ok) {
        out.push({
          id: "perm",
          group: "permission",
          label: "permission dump",
          verdict: "fail",
          detail: dump.text,
        });
      } else {
        for (const perm of PERMS) {
          const g = grantOf(dump.text, perm);
          const short = perm.replace("android.permission.", "").toLowerCase();
          const optional = perm.endsWith("BACKGROUND_LOCATION");
          out.push({
            id: perm,
            group: "permission",
            label: short,
            verdict: g === true ? "ok" : g === false ? (optional ? "warn" : "fail") : "unknown",
            detail:
              g === true ? "granted" : g === false ? "denied" : "not declared for this package",
          });
        }
      }

      const loc = await safe("shell settings get secure location_mode");
      const mode = loc.text.trim();
      out.push({
        id: "location_mode",
        group: "permission",
        label: "location services",
        verdict: !loc.ok ? "fail" : mode === "0" ? "fail" : mode === "null" ? "unknown" : "ok",
        detail: !loc.ok
          ? loc.text
          : mode === "0"
            ? "off — wifi scans return empty"
            : `mode ${mode}`,
      });

      const throttle = await safe("shell settings get global wifi_scan_throttle_enabled");
      const th = throttle.text.trim();
      out.push({
        id: "throttle",
        group: "scan",
        label: "scan throttling",
        verdict: !throttle.ok ? "unknown" : th === "0" ? "ok" : "warn",
        detail:
          th === "0"
            ? "disabled — full scan rate"
            : th === "1"
              ? "enabled — 4 scans / 2 min cap"
              : throttle.text.trim() || "unreported",
      });

      /* ---- scan activity ---- */
      const wifi = await safe("shell cmd wifi status");
      const enabled = /Wifi is enabled/i.test(wifi.text);
      out.push({
        id: "wifi_state",
        group: "scan",
        label: "wifi radio",
        verdict: !wifi.ok ? "fail" : enabled ? "ok" : "fail",
        detail: !wifi.ok ? wifi.text : enabled ? "enabled" : "disabled",
        ...(wifi.ok ? { raw: wifi.text } : {}),
      });

      const scan = await safe("shell cmd wifi list-scan-results");
      const aps = scan.ok ? parseScanResults(scan.text) : [];
      out.push({
        id: "scan_results",
        group: "scan",
        label: "scan activity",
        verdict: !scan.ok ? "fail" : aps.length > 0 ? "ok" : "warn",
        detail: !scan.ok
          ? scan.text
          : aps.length
            ? `${aps.length} ap · strongest ${Math.max(...aps.map((a) => a.rssi))} dBm`
            : "0 results — throttled, location off, or no radios in range",
        ...(scan.ok ? { raw: scan.text } : {}),
      });

      const gps = await safe("shell dumpsys location");
      out.push({
        id: "gps_provider",
        group: "map",
        label: "location providers",
        verdict: !gps.ok ? "unknown" : /gps provider/i.test(gps.text) ? "ok" : "warn",
        detail: !gps.ok
          ? gps.text
          : /gps provider/i.test(gps.text)
            ? "gps + network providers present"
            : "no gps provider reported",
        ...(gps.ok ? { raw: gps.text } : {}),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "diagnostics failed");
    } finally {
      setChecks(out);
      setAt(Date.now());
      setRunning(false);
      busy.current = false;
    }
  }, [run]);

  useEffect(() => {
    if (state === "online") void sweep();
  }, [state, sweep]);

  /* browser-side map + geolocation checks never need the bridge */
  const [geoPerm, setGeoPerm] = useState<string>("unknown");
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        setGeoPerm(p.state);
        p.onchange = () => setGeoPerm(p.state);
      })
      .catch(() => setGeoPerm("unknown"));
  }, []);

  const mapChecks: Check[] = [
    {
      id: "map_ready",
      group: "map",
      label: "map renderer",
      verdict: map.ready ? "ok" : "unknown",
      detail: map.ready ? `leaflet live on /tool/${map.tool}` : "no map mounted — open a map tool",
    },
    {
      id: "map_size",
      group: "map",
      label: "canvas size",
      verdict: map.ready ? (map.width > 0 && map.height > 0 ? "ok" : "fail") : "unknown",
      detail: map.ready ? `${map.width} × ${map.height} px full-bleed` : "—",
    },
    {
      id: "map_tiles",
      group: "map",
      label: "tiles",
      verdict: !map.ready
        ? "unknown"
        : map.tileErrors > 0
          ? map.tilesLoaded > 0
            ? "warn"
            : "fail"
          : map.tilesLoaded > 0
            ? "ok"
            : "warn",
      detail: map.ready ? `${map.tilesLoaded} loaded · ${map.tileErrors} failed` : "—",
    },
    {
      id: "map_plot",
      group: "map",
      label: "overlay plot",
      verdict: map.fix ? "ok" : "unknown",
      detail: map.fix ? `${map.markers} feature(s) drawn` : "waiting for a gps fix",
    },
    {
      id: "geo_perm",
      group: "permission",
      label: "watch geolocation",
      verdict: geoPerm === "granted" ? "ok" : geoPerm === "denied" ? "fail" : "warn",
      detail: geoPerm,
    },
  ];

  const all = [...checks, ...mapChecks];
  const groups: Array<{ key: Check["group"]; title: string }> = [
    { key: "permission", title: "permissions" },
    { key: "scan", title: "wifi scan" },
    { key: "map", title: "map render" },
  ];

  const failures = all.filter((c) => c.verdict === "fail").length;
  const warnings = all.filter((c) => c.verdict === "warn").length;

  return (
    <main className="flex h-app w-full flex-col overflow-hidden bg-background p-[var(--face-inset)] text-foreground">
      <header className="mb-1 flex shrink-0 items-center gap-1.5">
        <Link
          to="/app"
          aria-label="Back"
          className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground active:bg-accent"
        >
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-widest text-scan">
          Diagnostics
        </h1>
        <button
          type="button"
          onClick={() => void sweep()}
          disabled={running || state !== "online"}
          className="shrink-0 rounded-sm border border-scan/50 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
        >
          {running ? "…" : "run"}
        </button>
      </header>

      <div className="mb-1 shrink-0 rounded-sm border border-border bg-card/70 px-2 py-1">
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          link {state}
          {latency ? ` · ${latency}ms` : ""} · {target ?? "no endpoint"}
        </p>
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          last refresh {ago(at)} · map {ago(map.at)}
        </p>
        <p className="truncate text-[8px] uppercase tracking-wider">
          <span className={failures ? "text-alert" : "text-signal"}>{failures} fail</span>
          <span className="text-muted-foreground"> · </span>
          <span className={warnings ? "text-warn" : "text-muted-foreground"}>{warnings} warn</span>
          <span className="text-muted-foreground"> · {all.length} checks</span>
        </p>
      </div>

      {err ? (
        <p className="mb-1 shrink-0 truncate text-[8px] uppercase tracking-wider text-alert">
          {err}
        </p>
      ) : null}

      {state !== "online" ? (
        <p className="mb-1 shrink-0 text-[8px] uppercase tracking-wider text-warn">
          bridge offline — device checks unavailable, map checks still live
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((g) => {
          const rows = all.filter((c) => c.group === g.key);
          if (!rows.length) return null;
          return (
            <section key={g.key} className="mb-1.5">
              <h2 className="mb-0.5 text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                {g.title}
              </h2>
              <ul className="grid gap-1">
                {rows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(open === c.id ? null : c.id)}
                      className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 rounded-sm border bg-card/70 px-1.5 py-1 text-left ${TONE[c.verdict]}`}
                    >
                      <span className="text-[10px] leading-none">{MARK[c.verdict]}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[9px] font-bold uppercase tracking-widest">
                          {c.label}
                        </span>
                        <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                          {c.detail}
                        </span>
                      </span>
                    </button>
                    {open === c.id && c.raw ? (
                      <pre className="mt-0.5 max-h-24 overflow-auto rounded-sm border border-border bg-background/80 p-1 text-[7px] leading-tight text-muted-foreground">
                        {c.raw.slice(0, 4000)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
