import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useBridge } from "@/lib/bridge-hooks";

/**
 * One big button for the whole bridge: tap once to find the agent, connect
 * the phone and keep the feed running. Tap again to stop. Plain words only —
 * no ports, no jargon. When a link attempt fails we say why in one sentence
 * and point at the setup screen instead of spinning forever.
 */
export default function OneTapLink({ compact = false }: { compact?: boolean }) {
  const { state, autoLink, disconnect, diagnosis } = useBridge();
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  const online = state === "online";
  const busy = working || state === "connecting" || state === "agent" || state === "failing";

  const label = online
    ? "CONNECTED · TAP TO STOP"
    : busy
      ? "LINKING… · TAP TO CANCEL"
      : "TAP TO CONNECT";
  const tone = online
    ? "border-signal bg-signal/20 text-signal"
    : busy
      ? "border-warn bg-warn/15 text-warn"
      : failed
        ? "border-destructive bg-destructive/15 text-destructive"
        : "border-scan bg-scan/15 text-scan";

  const hint = online
    ? "live data is flowing — it stays on until you stop it"
    : busy
      ? "looking for your phone or computer…"
      : (diagnosis ?? "turns on live phone data");

  const onTap = async () => {
    if (online || busy) {
      disconnect();
      setWorking(false);
      return;
    }
    setWorking(true);
    setFailed(false);
    try {
      const ok = await autoLink();
      setFailed(!ok);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onTap}
        aria-live="polite"
        className={`w-full rounded-md border-2 ${tone} ${
          compact ? "py-2 text-[10px]" : "py-3 text-[12px]"
        } font-bold uppercase tracking-[0.18em] active:opacity-80`}
      >
        {label}
      </button>
      <p className="mt-1 text-center text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        {hint}
      </p>
      {!online && !busy && failed ? (
        <Link
          to="/settings"
          className="mt-1 block text-center text-[8px] uppercase tracking-[0.2em] text-scan underline"
        >
          open setup help
        </Link>
      ) : null}
    </div>
  );
}
