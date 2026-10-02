import { useRenderDiagnostics } from "@/lib/render-diagnostics";

/**
 * Diagnostic mode overlay.
 *
 * Confirms, in one glance on a 400px face, that the watch is painting through
 * the same pathway as the phone/tablet build (accelerated canvas) after a
 * remount succeeds — or names the reason it fell back to SVG.
 */
export default function RenderDiagnostics({ className }: { className?: string }) {
  const { diag, enabled } = useRenderDiagnostics();
  if (!enabled) return null;

  const parity = diag.parity;
  const tone = parity ? "text-signal" : diag.safeMode ? "text-alert" : "text-scan";

  return (
    <div
      className={
        className ??
        "pointer-events-none absolute left-1 top-1 z-40 max-w-[86%] rounded-sm border border-border bg-background/85 px-1.5 py-1"
      }
    >
      <p className={`truncate text-[8px] font-bold uppercase tracking-widest ${tone}`}>
        {parity ? "parity · phone pathway" : `divergent · ${diag.pathway}`}
      </p>
      <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
        {diag.deviceClass} · ref {diag.reference} · try {diag.attempt}
      </p>
      <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
        probe {diag.probe === null ? "—" : diag.probe ? "ok" : "fail"} ·{" "}
        {diag.legacy ? "legacy webview" : "modern webview"} ·{" "}
        {diag.firstFrameMs !== null ? `${diag.firstFrameMs}ms` : "no frame"}
      </p>
      {diag.safeMode ? (
        <p className="truncate text-[8px] uppercase tracking-wider text-alert">
          safe mode · {diag.safeReason ?? "load error"}
        </p>
      ) : null}
      <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
        {diag.log[diag.log.length - 1]?.msg ?? "waiting for first frame"}
      </p>
    </div>
  );
}
