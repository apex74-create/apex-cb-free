import { Link } from "@tanstack/react-router";
import { sovereignLabel, useSovereign } from "@/lib/sovereign";

/**
 * Wrist-sized readiness pill for the sovereign chat token: pulses green when the
 * keypair is loaded, the hash chain verifies and there is float to spend.
 */
export default function SovereignBadge({ className = "" }: { className?: string }) {
  const s = useSovereign();
  const tone = s.ready
    ? "text-signal border-signal/60"
    : s.error || !s.verified
      ? "text-alert border-alert/60"
      : "text-warn border-warn/60";

  return (
    <Link
      to="/netchat"
      className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border bg-background/75 px-1.5 py-[2px] text-[7px] uppercase tracking-[0.18em] backdrop-blur-[1px] ${tone} ${className}`}
      aria-label={sovereignLabel(s)}
    >
      <span
        className={`inline-block h-1 w-1 rounded-full bg-current ${s.ready ? "animate-pulse" : ""}`}
      />
      <span className="truncate">{sovereignLabel(s)}</span>
      {s.address ? <span className="tabular-nums opacity-70">{s.balance}c</span> : null}
    </Link>
  );
}
