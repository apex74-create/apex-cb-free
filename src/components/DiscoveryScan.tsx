import { useEffect, useRef, useState } from "react";
import { buildCandidates, discoverAgents, insecureBlocked, type FoundAgent } from "@/lib/discovery";
import { KIND_LABEL, type BridgeEndpoint, type BridgeKind } from "@/lib/bridge";

/**
 * One-tap discovery: sweeps the Wi-Fi subnet (and any configured relay for the
 * 4G case), then lets the user assign a found agent to a slot in the chain.
 */
export default function DiscoveryScan({
  endpoints,
  target,
  onAssign,
}: {
  endpoints: BridgeEndpoint[];
  target: string;
  onAssign: (endpointId: string, url: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [found, setFound] = useState<FoundAgent[]>([]);
  const [picked, setPicked] = useState<FoundAgent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const candidates = buildCandidates(endpoints, target);
    setFound([]);
    setPicked(null);
    setDone(0);
    setTotal(candidates.length);
    setScanning(true);
    try {
      await discoverAgents(
        candidates,
        (count, hit) => {
          setDone(count);
          if (hit)
            setFound((prev) => (prev.some((f) => f.url === hit.url) ? prev : [...prev, hit]));
        },
        controller.signal,
      );
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  };

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mb-3 rounded-sm border border-scan/60 p-2">
      <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Find agents on this network
      </p>

      <button
        type="button"
        onClick={() => (scanning ? (abortRef.current?.abort(), setScanning(false)) : start())}
        className="w-full rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
      >
        {scanning ? `stop · ${pct}% · ${found.length} found` : "scan network"}
      </button>

      {insecureBlocked() ? (
        <p className="mt-1 text-[7px] uppercase leading-snug text-alert">
          https page · only wss:// agents are reachable
        </p>
      ) : null}

      {!scanning && total > 0 && found.length === 0 ? (
        <p className="mt-1 text-[7px] uppercase leading-snug text-warn">
          no agents answered on {total} addresses
        </p>
      ) : null}

      {found.length ? (
        <ul className="mt-1.5 space-y-1">
          {found.map((f) => (
            <li key={f.url}>
              <button
                type="button"
                onClick={() => setPicked(picked?.url === f.url ? null : f)}
                className={`w-full rounded-sm border px-1.5 py-1 text-left ${
                  picked?.url === f.url ? "border-signal" : "border-border"
                }`}
              >
                <span className="block truncate text-[9px] text-foreground">{f.host}</span>
                <span className="block truncate text-[7px] uppercase tracking-wider text-muted-foreground">
                  {f.agent} · adb {f.adb ?? "missing"} · {f.ms}ms
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {picked ? (
        <div className="mt-1.5">
          <p className="pb-1 text-[7px] uppercase tracking-widest text-muted-foreground">
            use as target
          </p>
          <div className="grid grid-cols-3 gap-1">
            {endpoints.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onAssign(e.id, picked.url);
                  setPicked(null);
                }}
                className="rounded-sm border border-border py-1 text-[7px] uppercase tracking-widest text-muted-foreground active:text-signal"
              >
                {KIND_LABEL[e.kind as BridgeKind]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
