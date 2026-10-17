import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import { getMeshStatus, meshLive, subscribeMesh, type MeshStatus } from "@/lib/mesh-status";

/**
 * Radio features (Wi-Fi scan, Reticulum/LXMF chat, cell survey) have no
 * browser-side source: the paired phone agent is the radio. When the ADB
 * bridge is down the panels below are structurally empty, so say that
 * plainly and hand the user a one-tap route to fix it instead of showing
 * a wall of zeroes that looks like a broken app.
 *
 * When the bridge IS up but the Reticulum node has not been attached yet,
 * mesh traffic still cannot arrive — call that out separately so the fix
 * (attach the node on /bridge) is obvious.
 */
export function BridgeGate({ what, mesh = false }: { what: string; mesh?: boolean }) {
  const { state } = useBridge();
  const [node, setNode] = useState<MeshStatus>(() => getMeshStatus());

  useEffect(() => subscribeMesh(setNode), []);

  if (state === "online") {
    if (!mesh || meshLive(node)) return null;
    return (
      <div className="mb-2 rounded-sm border border-scan/60 bg-scan/10 px-2 py-1.5 text-[8px] uppercase tracking-widest">
        <p className="text-scan">bridge up · mesh node not attached</p>
        <p className="mt-1 normal-case tracking-normal text-[9px] leading-snug text-muted-foreground">
          The phone link is live, but the Reticulum daemon is not running yet, so no mesh traffic
          can arrive. Attach the node once and it stays up.
        </p>
        <Link
          to="/bridge"
          className="mt-1.5 inline-block rounded-sm border border-signal/70 px-2 py-1 text-signal"
        >
          attach mesh node →
        </Link>
      </div>
    );
  }

  const connecting = state === "connecting" || state === "agent";

  return (
    <div className="mb-2 rounded-sm border border-warn/60 bg-warn/10 px-2 py-1.5 text-[8px] uppercase tracking-widest">
      <p className="text-warn">{connecting ? "bridge linking…" : "no bridge · no radio source"}</p>
      <p className="mt-1 normal-case tracking-normal text-[9px] leading-snug text-muted-foreground">
        {what} runs on the paired phone (adb agent + rnsd). The browser cannot scan Wi-Fi or send
        mesh traffic by itself, so everything here stays empty until the link is up.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Link
          to="/bridge"
          className="inline-block rounded-sm border border-signal/70 px-2 py-1 text-signal"
        >
          connect bridge →
        </Link>
        <Link
          to="/ptt"
          className="inline-block rounded-sm border border-alert/70 px-2 py-1 text-alert"
        >
          talk without a bridge · ptt
        </Link>
      </div>
    </div>
  );
}
