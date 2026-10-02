import { useState } from "react";
import { bluetoothSupported, connectApexBridge, sendCommand } from "@/lib/ble-bridge";

export default function BlePanel() {
  const [status, setStatus] = useState("idle");
  const [last, setLast] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const activate = async () => {
    setErr(null);
    try {
      await connectApexBridge({ onMessage: (m) => setLast(JSON.stringify(m)), onStatus: setStatus });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
      setStatus("offline");
    }
  };

  return (
    <div className="mb-2 rounded-sm border border-border bg-card/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-widest text-scan">BLE · {status}</span>
        <div className="flex gap-1">
          <button type="button" onClick={activate} disabled={!bluetoothSupported()}
            className="rounded-sm border border-signal px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-signal disabled:opacity-40">
            activate bridge
          </button>
          <button type="button" disabled={status !== "online"}
            onClick={() => sendCommand({ type: "ping", t: Date.now() }).catch((e) => setErr(String(e)))}
            className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground disabled:opacity-40">
            ping
          </button>
        </div>
      </div>
      {!bluetoothSupported() ? <p className="text-[8px] text-muted-foreground">No Bluetooth in this browser.</p> : null}
      {err ? <p className="text-[8px] text-warn">{err}</p> : null}
      {last ? <p className="truncate text-[8px] text-signal">{last}</p> : null}
    </div>
  );
}
