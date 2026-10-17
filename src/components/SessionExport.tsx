import { useState } from "react";
import {
  buildSessionReport,
  copyReport,
  downloadReport,
  shareReport,
  type SessionSnapshot,
} from "@/lib/session-export";

/** Export the bridge session (latency, outputs, errors) for troubleshooting. */
export default function SessionExport({ snapshot }: { snapshot: SessionSnapshot }) {
  const [status, setStatus] = useState("");

  const act = async (label: string, fn: (text: string) => Promise<string> | string) => {
    try {
      const result = await fn(buildSessionReport(snapshot));
      setStatus(result || `${label} ok`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed`);
    }
  };

  return (
    <div className="mt-2 rounded-sm border border-border p-2">
      <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Export session · {snapshot.log.length} entries
      </p>
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => act("download", (t) => (downloadReport(t), "saved .txt"))}
          className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal active:bg-accent"
        >
          file
        </button>
        <button
          type="button"
          onClick={() => act("share", shareReport)}
          className="rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
        >
          share
        </button>
        <button
          type="button"
          onClick={() => act("copy", copyReport)}
          className="rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          copy
        </button>
      </div>
      {status ? (
        <p className="mt-1 break-words text-[8px] leading-snug text-warn">{status}</p>
      ) : null}
    </div>
  );
}
