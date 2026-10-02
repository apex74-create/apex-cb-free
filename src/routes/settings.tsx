import { createFileRoute, Link } from "@tanstack/react-router";
import { useFaceShape } from "@/lib/face-shape";
import { useBridge } from "@/lib/bridge-hooks";
import { setPerfOverlay, usePerfOverlayEnabled } from "@/lib/perf-overlay";
import {
  INSET_RANGE,
  LINE_RANGE,
  SCALE_RANGE,
  useWatchSettings,
  type Autonomy,
} from "@/lib/watch-settings";
import {
  BACKOFF_RANGE,
  FACTOR_RANGE,
  RETRIES_RANGE,
  WATCHDOG_RANGE,
  retryDelay,
  useRenderTuning,
} from "@/lib/render-tuning";
import { useRenderDiagnostics } from "@/lib/render-diagnostics";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Watch Settings — Apex Signal" },
      {
        name: "description",
        content:
          "Tune font size, safe inset and standalone/paired operating mode so the console fits any watch face thickness.",
      },
      { property: "og:title", content: "Watch Settings — Apex Signal" },
      {
        property: "og:description",
        content:
          "Font scale, bezel safe inset and phone-independent operating mode for the watch console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsScreen,
});

const MODES: { id: Autonomy; label: string; blurb: string }[] = [
  { id: "standalone", label: "standalone", blurb: "watch only · no phone dialled" },
  { id: "auto", label: "auto", blurb: "use phone if up, else watch sensors" },
  { id: "paired", label: "paired", blurb: "phone bridge required" },
];

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 rounded-sm border border-border bg-card/60 px-2 py-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="min-w-0 truncate text-[9px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="shrink-0 text-[10px] text-signal">{value}</span>
      </div>
      <div className="pt-1.5">{children}</div>
    </div>
  );
}

function SettingsScreen() {
  const { settings, update, reset } = useWatchSettings();
  const { shape, toggle } = useFaceShape();
  const { tuning, update: setTuning, reset: resetTuning } = useRenderTuning();
  const { diag, enabled: diagEnabled, setEnabled: setDiagEnabled } = useRenderDiagnostics();
  const perfOn = usePerfOverlayEnabled();
  const setPerfOn = setPerfOverlay;
  const bridge = useBridge();

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid face-pad pb-6 pt-2">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pb-2">
        <Link to="/app" className="shrink-0 text-[11px] text-muted-foreground active:text-signal">
          ‹
        </Link>
        <h1 className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
          Watch Settings
        </h1>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-alert"
        >
          reset
        </button>
      </header>

      <Row label="font / ui scale" value={`${Math.round(settings.scale * 100)}%`}>
        <input
          type="range"
          aria-label="Font and UI scale"
          min={SCALE_RANGE.min}
          max={SCALE_RANGE.max}
          step={SCALE_RANGE.step}
          value={settings.scale}
          onChange={(e) => update("scale", Number(e.target.value))}
          className="h-6 w-full accent-[oklch(0.86_0.22_155)]"
        />
      </Row>

      <Row
        label="safe inset"
        value={settings.inset === 0 ? `auto (${shape})` : `${settings.inset}%`}
      >
        <input
          type="range"
          aria-label="Safe inset percentage"
          min={INSET_RANGE.min}
          max={INSET_RANGE.max}
          step={INSET_RANGE.step}
          value={settings.inset}
          onChange={(e) => update("inset", Number(e.target.value))}
          className="h-6 w-full accent-[oklch(0.79_0.14_220)]"
        />
      </Row>

      <Row label="line height" value={settings.lineHeight.toFixed(2)}>
        <input
          type="range"
          aria-label="Line height"
          min={LINE_RANGE.min}
          max={LINE_RANGE.max}
          step={LINE_RANGE.step}
          value={settings.lineHeight}
          onChange={(e) => update("lineHeight", Number(e.target.value))}
          className="h-6 w-full accent-[oklch(0.79_0.17_70)]"
        />
      </Row>

      {/* Live clip test: if any of these three lines touch the bezel, the
          inset is too small for this face. */}
      <section className="mb-2 rounded-sm border border-dashed border-signal/50 bg-card/40 px-2 py-1.5">
        <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">clip test</p>
        <p className="text-[11px] font-bold uppercase tracking-widest text-signal">
          RSSI −72dBm · gj Qy
        </p>
        <p className="text-[9px] uppercase tracking-wider text-scan">ssid: HOMEBASE_5G · ch 149</p>
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          bearing 284° · lock · 12 nodes · agent pc
        </p>
      </section>

      {/* Dependency-free boot page: loads even when the app bundle cannot
          paint, and picks the render pathway the device can handle. */}
      <section className="mb-2 rounded-sm border border-scan/40 bg-card/50 px-2 py-1.5">
        <p className="pb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
          plain-html boot page
        </p>
        <a
          href="/land.html"
          className="block rounded-sm border border-signal/60 px-1.5 py-1 text-center text-[9px] uppercase tracking-widest text-signal"
        >
          open render source select
        </a>
      </section>

      {/* Face render watchdog: raise these on a slow WebView that needs a
          longer window before the SVG fallback takes over. */}
      <section className="mb-2 rounded-sm border border-scan/40 bg-card/50 px-2 py-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-1">
          <p className="min-w-0 truncate text-[9px] uppercase tracking-widest text-muted-foreground">
            face render watchdog
          </p>
          <button
            type="button"
            onClick={resetTuning}
            className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-alert"
          >
            defaults
          </button>
        </div>

        <Row label="first-frame timeout" value={`${tuning.watchdogMs} ms`}>
          <input
            type="range"
            aria-label="Canvas first frame timeout in milliseconds"
            min={WATCHDOG_RANGE.min}
            max={WATCHDOG_RANGE.max}
            step={WATCHDOG_RANGE.step}
            value={tuning.watchdogMs}
            onChange={(e) => setTuning("watchdogMs", Number(e.target.value))}
            className="h-6 w-full accent-[oklch(0.79_0.14_220)]"
          />
        </Row>

        <Row label="retry backoff" value={`${tuning.backoffMs} ms`}>
          <input
            type="range"
            aria-label="Retry backoff in milliseconds"
            min={BACKOFF_RANGE.min}
            max={BACKOFF_RANGE.max}
            step={BACKOFF_RANGE.step}
            value={tuning.backoffMs}
            onChange={(e) => setTuning("backoffMs", Number(e.target.value))}
            className="h-6 w-full accent-[oklch(0.86_0.22_155)]"
          />
        </Row>

        <Row label="backoff factor" value={`x${tuning.backoffFactor.toFixed(1)}`}>
          <input
            type="range"
            aria-label="Backoff growth factor"
            min={FACTOR_RANGE.min}
            max={FACTOR_RANGE.max}
            step={FACTOR_RANGE.step}
            value={tuning.backoffFactor}
            onChange={(e) => setTuning("backoffFactor", Number(e.target.value))}
            className="h-6 w-full accent-[oklch(0.79_0.17_70)]"
          />
        </Row>

        <Row label="max retries" value={String(tuning.maxRetries)}>
          <input
            type="range"
            aria-label="Maximum canvas remount retries"
            min={RETRIES_RANGE.min}
            max={RETRIES_RANGE.max}
            step={RETRIES_RANGE.step}
            value={tuning.maxRetries}
            onChange={(e) => setTuning("maxRetries", Number(e.target.value))}
            className="h-6 w-full accent-[oklch(0.7_0.2_20)]"
          />
        </Row>

        <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
          retries at{" "}
          {Array.from({ length: tuning.maxRetries }, (_, i) => `${retryDelay(tuning, i)}ms`).join(
            " · ",
          ) || "none"}{" "}
          · then svg face
        </p>

        {/* Diagnostic mode: proves the watch reached the same rendering
            pathway the phone/tablet build uses after a remount. */}
        <button
          type="button"
          onClick={() => setDiagEnabled(!diagEnabled)}
          className={`mt-1 w-full rounded-sm border px-2 py-1 text-left text-[9px] uppercase tracking-widest ${
            diagEnabled ? "border-signal/60 text-signal" : "border-border text-muted-foreground"
          }`}
        >
          diagnostic mode · {diagEnabled ? "on" : "off"}
        </button>
        <p className="pt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
          pathway {diag.pathway} · ref {diag.reference} ·{" "}
          {diag.parity ? "parity with phone build" : "divergent"}
        </p>
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          {diag.deviceClass} · probe {diag.probe === null ? "—" : diag.probe ? "ok" : "fail"} · try{" "}
          {diag.attempt} ·{" "}
          {diag.firstFrameMs !== null ? `first frame ${diag.firstFrameMs}ms` : "no canvas frame"}
        </p>
        {/* Live FPS + JS heap readout, for proving smooth rendering on-watch. */}
        <button
          type="button"
          onClick={() => setPerfOn(!perfOn)}
          className={`mt-1 w-full rounded-sm border px-2 py-1 text-left text-[9px] uppercase tracking-widest ${
            perfOn ? "border-signal/60 text-signal" : "border-border text-muted-foreground"
          }`}
        >
          fps / memory overlay · {perfOn ? "on" : "off"}
        </button>
        {diag.safeMode ? (
          <p className="truncate text-[8px] uppercase tracking-wider text-alert">
            safe mode · {diag.safeReason ?? "load error"} · recovering next retry
          </p>
        ) : null}
      </section>

      <section className="mb-2">
        <p className="pb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
          face shape
        </p>
        <button
          type="button"
          onClick={toggle}
          className="w-full rounded-sm border border-border bg-card/60 px-2 py-1.5 text-left text-[10px] uppercase tracking-widest text-signal active:bg-accent"
        >
          {shape === "round" ? "◯ round bezel" : "▢ square face"} — tap to switch
        </button>
      </section>

      <section className="mb-2">
        <p className="pb-1 text-[9px] uppercase tracking-widest text-muted-foreground">
          operating mode
        </p>
        {MODES.map((m) => {
          const active = settings.autonomy === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => update("autonomy", m.id)}
              aria-pressed={active}
              className={`mb-1 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-sm border px-2 py-1.5 text-left active:bg-accent ${
                active ? "border-signal/70 bg-card" : "border-border bg-card/50"
              }`}
            >
              <span
                className={`shrink-0 text-[10px] ${active ? "text-signal" : "text-muted-foreground"}`}
              >
                {active ? "◉" : "○"}
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate text-[10px] font-bold uppercase tracking-widest ${
                    active ? "text-signal" : "text-foreground"
                  }`}
                >
                  {m.label}
                </span>
                <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                  {m.blurb}
                </span>
              </span>
            </button>
          );
        })}
        <p className="pt-0.5 text-[8px] uppercase tracking-wider text-muted-foreground">
          link: {settings.autonomy === "standalone" ? "disabled" : bridge.state}
          {settings.autonomy === "standalone"
            ? " · phone bridge disabled"
            : settings.autonomy === "auto"
              ? " · falls back to watch sensors"
              : " · tools idle without phone"}
        </p>
      </section>

      <Link
        to="/bridge"
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
      >
        <span className="shrink-0 text-sm leading-none text-scan">⇋</span>
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-widest text-scan">
          bridge endpoints
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
      </Link>
    </main>
  );
}
