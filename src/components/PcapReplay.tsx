import { useCallback, useState } from "react";
import { loadDemoCapture, toFlows, type Flow } from "@/lib/pcap-replay";

/**
 * Replays the bundled libpcap capture so the flow view has real packets to
 * show when no phone is attached. Same parser shape as the live counters —
 * the file is a genuine PCAPdroid dump, not generated traffic.
 */
export default function PcapReplay() {
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const packets = await loadDemoCapture();
      setCount(packets.length);
      setFlows(toFlows(packets).slice(0, 25));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="mt-3 border-t border-border pt-2">
      <div className="flex items-center justify-between">
        <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
          replay demo capture{count ? ` · ${count} packets` : ""}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="rounded-sm border border-scan/60 px-2 py-0.5 text-[8px] uppercase tracking-widest text-scan disabled:opacity-40"
        >
          {busy ? "parsing" : flows ? "reload" : "load"}
        </button>
      </div>
      {err && <p className="mt-1 text-[9px] text-alert">{err}</p>}
      <ul className="mt-1 space-y-0.5">
        {flows?.map((f) => (
          <li key={f.key} className="flex justify-between gap-2 text-[8px]">
            <span className="truncate text-foreground">
              {f.src} → {f.dst}:{f.port}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {f.proto} · {f.packets}p · {(f.bytes / 1024).toFixed(1)}k
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
