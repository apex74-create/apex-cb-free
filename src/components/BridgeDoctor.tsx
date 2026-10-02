import { useCallback, useEffect, useRef, useState } from "react";
import { probeWithRetry, type ProbeResult } from "@/lib/agent-probe";
import { detectLocalIp, isPrivateIpv4, rankHosts } from "@/lib/lan-host";
import { usePhoneLanIp } from "@/lib/lan-ip";
import { KIND_LABEL, type BridgeEndpoint, type LinkState } from "@/lib/bridge";

/** Ports the companion worker is normally reachable on (3001 = deploy port). */
const PHONE_AGENT_PORTS = [3001, 8787];

type Row = {
  key: string;
  label: string;
  url: string;
  result: ProbeResult | null;
  running: boolean;
};

/**
 * Tap-connect troubleshooting panel.
 *
 * Answers the two questions a failed tap always raises: *what is it dialing*
 * and *is the phone worker on :3001 actually reachable*. Every row is a real
 * handshake with retry, not a guess.
 */
export default function BridgeDoctor({
  endpoints,
  target,
  activeId,
  state,
  diagnosis,
}: {
  endpoints: BridgeEndpoint[];
  target: string;
  activeId: string | null;
  state: LinkState;
  diagnosis?: string | null;
}) {
  const { iface } = usePhoneLanIp(30000);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    detectLocalIp().then((ip) => {
      if (alive) setLocalIp(ip);
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const origin = typeof window !== "undefined" ? window.location.origin : "server render";
  const scheme = isHttps ? "wss://" : "ws://";

  const candidates = rankHosts({
    pageHost: typeof window !== "undefined" ? window.location.hostname : null,
    pageIsHttps: isHttps,
    webrtcHost: localIp,
    phoneIp: iface?.ip ?? null,
    phoneIface: iface?.name ?? null,
    adbTarget: target,
  });

  const phoneHost =
    candidates.find((c) => c.source === "phone")?.host ??
    candidates.find((c) => isPrivateIpv4(c.host))?.host ??
    target.split(":")[0] ??
    "";

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const list: Row[] = endpoints
      .filter((e) => e.url)
      .map((e) => ({
        key: e.id,
        label: `${KIND_LABEL[e.kind]}${activeId === e.id ? " ●" : ""}`,
        url: e.url,
        result: null,
        running: true,
      }));

    if (phoneHost) {
      for (const port of PHONE_AGENT_PORTS) {
        const url = `${scheme}${phoneHost}:${port}/adb`;
        if (list.some((r) => r.url === url)) continue;
        list.push({
          key: `phone${port}`,
          label: `PHONE :${port}`,
          url,
          result: null,
          running: true,
        });
      }
    }

    setRows(list);
    setBusy(true);
    try {
      for (const row of list) {
        if (ctrl.signal.aborted) break;
        const result = await probeWithRetry(row.url, {
          timeoutMs: 3000,
          retries: 2,
          backoffMs: 600,
          signal: ctrl.signal,
        });
        setRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, result, running: false } : r)),
        );
      }
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
      setRows((prev) => prev.map((r) => ({ ...r, running: false })));
    }
  }, [endpoints, activeId, phoneHost, scheme]);

  return (
    <section className="mb-3 rounded-sm border border-warn/60 p-2">
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="text-[8px] uppercase tracking-widest text-warn">Tap-connect doctor</p>
        <button
          type="button"
          onClick={busy ? () => abortRef.current?.abort() : run}
          className="rounded-sm border border-warn px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-warn"
        >
          {busy ? "stop" : "run checks"}
        </button>
      </div>

      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-1 gap-y-0.5 text-[8px]">
        <dt className="uppercase text-muted-foreground">page</dt>
        <dd className="break-all text-foreground">{origin}</dd>
        <dt className="uppercase text-muted-foreground">dials</dt>
        <dd className="text-foreground">{scheme} sockets only</dd>
        <dt className="uppercase text-muted-foreground">link</dt>
        <dd className={state === "online" ? "text-signal" : "text-warn"}>
          {state}
          {diagnosis ? ` · ${diagnosis}` : ""}
        </dd>
        <dt className="uppercase text-muted-foreground">phone</dt>
        <dd className="break-all text-foreground">
          {iface ? `${iface.name} ${iface.ip}` : "not read yet — needs a live link"}
        </dd>
        <dt className="uppercase text-muted-foreground">this dev</dt>
        <dd className="break-all text-foreground">{localIp ?? "not exposed by browser"}</dd>
        <dt className="uppercase text-muted-foreground">adb tgt</dt>
        <dd className="break-all text-foreground">{target || "unset"}</dd>
      </dl>

      {isHttps ? (
        <p className="pt-1 text-[7px] uppercase leading-snug text-alert">
          HTTPS page — plain ws:// agents are blocked by the browser. Serve the worker over wss://
          or open the app on http://.
        </p>
      ) : null}

      <ul className="mt-1.5 space-y-1">
        {rows.length === 0 ? (
          <li className="text-[8px] uppercase tracking-widest text-muted-foreground">
            run checks to handshake every configured agent
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.key} className="rounded-sm border border-border p-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[8px] font-bold uppercase tracking-widest text-signal">
                  {row.label}
                </span>
                <span
                  className={`shrink-0 text-[7px] uppercase tracking-widest ${
                    row.running ? "text-warn" : row.result?.ok ? "text-signal" : "text-alert"
                  }`}
                >
                  {row.running
                    ? "probing…"
                    : row.result?.ok
                      ? `ok ${row.result.ms}ms`
                      : (row.result?.failure ?? "—")}
                </span>
              </div>
              <p className="break-all text-[7px] text-muted-foreground">{row.url}</p>
              {row.result ? (
                <p
                  className={`text-[7px] leading-snug ${row.result.ok ? "text-signal" : "text-warn"}`}
                >
                  {row.result.advice}
                  {row.result.attempts.length > 1
                    ? ` (${row.result.attempts.length} attempts)`
                    : ""}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
