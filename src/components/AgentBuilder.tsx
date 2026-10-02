import { useEffect, useMemo, useState } from "react";
import { probeWithRetry } from "@/lib/agent-probe";
import { detectLocalIp, rankHosts } from "@/lib/lan-host";
import { usePhoneLanIp } from "@/lib/lan-ip";
import {
  AGENT_PORT,
  KIND_LABEL,
  socketScheme,
  isSecurePage,
  type BridgeEndpoint,
} from "@/lib/bridge";

/** Ports the companion agent is normally started on. */
const PORTS = [3001, AGENT_PORT, 8788];

type Suggestion = { label: string; host: string };

/**
 * Companion server worker builder.
 *
 * Instead of hand-typing a socket URL, the operator picks a suggested host,
 * a port and a path; the scheme is chosen for them (wss:// on an HTTPS page,
 * ws:// otherwise). One button tests the real agent handshake, one button
 * commits the endpoint and dials it.
 */
export default function AgentBuilder({
  endpoints,
  target,
  onCommit,
}: {
  endpoints: BridgeEndpoint[];
  target: string;
  /** Save the built URL into a slot, then dial it. Resolves with a status line. */
  onCommit: (id: string, url: string, token: string) => Promise<string> | string;
}) {
  const { iface } = usePhoneLanIp(20000);
  const [slot, setSlot] = useState(endpoints[0]?.id ?? "phone");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(3001);
  const [path, setPath] = useState("/adb");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const [localIp, setLocalIp] = useState<string | null>(null);

  // Learn this device's own private address so the fields can prefill even
  // before the bridge is up and the phone can be read.
  useEffect(() => {
    let alive = true;
    detectLocalIp().then((ip) => {
      if (alive) setLocalIp(ip);
    });
    return () => {
      alive = false;
    };
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const ranked = rankHosts({
      pageHost: typeof window !== "undefined" ? window.location.hostname : null,
      pageIsHttps: isSecurePage(),
      webrtcHost: localIp,
      phoneIp: iface?.ip ?? null,
      phoneIface: iface?.name ?? null,
      adbTarget: target,
    }).map((c) => ({ label: c.label, host: c.host }));

    for (const e of endpoints) {
      try {
        const h = e.url ? new URL(e.url).hostname : "";
        if (h && !ranked.some((s2) => s2.host === h)) {
          ranked.push({ label: KIND_LABEL[e.kind].toLowerCase(), host: h });
        }
      } catch {
        /* ignore unparsable stored URL */
      }
    }
    return ranked.slice(0, 6);
  }, [iface, localIp, target, endpoints]);

  // Prefill the host field with the best detected candidate — never overwrite
  // something the operator typed.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && !host && suggestions[0]) setHost(suggestions[0].host);
  }, [suggestions, touched, host]);

  const scheme = socketScheme();
  const url = host.trim()
    ? `${scheme}://${host.trim()}:${port}${path.startsWith("/") ? path : `/${path}`}`
    : "";
  const mixed = isSecurePage() && scheme === "wss";

  const test = async () => {
    if (!url) return;
    setBusy(true);
    setStatus("handshaking…");
    setOk(null);
    try {
      const found = await probeWithRetry(url, { timeoutMs: 3000, retries: 2, backoffMs: 600 });
      setOk(found.ok);
      setStatus(
        found.ok
          ? `agent ${found.agent} · adb ${found.adb ?? "?"} · ${found.ms}ms`
          : `${found.failure} — ${found.advice}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!url) return;
    setBusy(true);
    setStatus("saved — dialing…");
    setOk(null);
    try {
      const msg = await onCommit(slot, url, token.trim());
      setStatus(msg || "committed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-3 rounded-sm border border-scan/60 p-2">
      <p className="pb-1 text-[8px] uppercase tracking-widest text-scan">Companion worker setup</p>

      <div className="flex flex-wrap gap-1 pb-1">
        {suggestions.map((s) => (
          <button
            key={`${s.label}-${s.host}`}
            type="button"
            onClick={() => {
              setTouched(true);
              setHost(s.host);
              setOk(null);
              setStatus(null);
            }}
            className={`rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
              host === s.host ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {s.label} · {s.host}
          </button>
        ))}
        {suggestions.length === 0 ? (
          <span className="text-[7px] uppercase text-muted-foreground">
            no hosts detected — type one
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] gap-1">
        <input
          value={host}
          onChange={(e) => {
            setTouched(true);
            setHost(e.target.value);
          }}
          placeholder="agent host or IP"
          spellCheck={false}
          autoCapitalize="none"
          inputMode="url"
          aria-label="Agent host"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
        <input
          value={port}
          onChange={(e) => setPort(Number(e.target.value.replace(/\D/g, "")) || 0)}
          inputMode="numeric"
          aria-label="Agent port"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
      </div>

      <div className="flex flex-wrap gap-1 pt-1">
        {PORTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPort(p)}
            className={`rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
              port === p ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            :{p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 pt-1">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/adb"
          spellCheck={false}
          aria-label="Agent socket path"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="token (optional)"
          spellCheck={false}
          autoCapitalize="none"
          aria-label="Agent token"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
      </div>

      <div className="flex flex-wrap gap-1 pt-1">
        {endpoints.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setSlot(e.id)}
            className={`rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
              slot === e.id ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {KIND_LABEL[e.kind]}
          </button>
        ))}
      </div>

      <p className="break-all pt-1 text-[8px] text-muted-foreground">{url || "url appears here"}</p>
      {mixed ? (
        <p className="text-[7px] uppercase text-warn">
          secure page — the worker must serve wss:// with a trusted certificate
        </p>
      ) : null}

      <div className="mt-1 grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={busy || !url}
          onClick={test}
          className="rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          test handshake
        </button>
        <button
          type="button"
          disabled={busy || !url}
          onClick={commit}
          className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal disabled:opacity-40"
        >
          commit + dial
        </button>
      </div>

      {status ? (
        <p
          className={`pt-1 text-[8px] leading-snug ${ok === false ? "text-alert" : ok ? "text-signal" : "text-warn"}`}
        >
          {status}
        </p>
      ) : null}
    </section>
  );
}
