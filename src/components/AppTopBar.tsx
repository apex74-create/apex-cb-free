import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import InstallButton from "@/components/InstallButton";
import { hostInfo } from "@/lib/host";

/**
 * The shared top control bar every app carries: layout mode
 * (Auto / Base / Handset), App/Browser fullscreen toggle, the install
 * button that lands the app badge on the home screen, and a slot for each
 * app's own nav links. Buttons keep the constant amber outline that
 * brightens and solidifies when actuated (see `.app-hbtn` in styles.css).
 *
 * Layout mode is remembered per app via `apex.layout.<storageKey>`.
 * Apps that reflow their body on layout change pass `onLayoutChange`;
 * apps that already own their layout state (the CB deck) pass controlled
 * `layout` / `onCycleLayout` instead.
 */
export type AppLayoutMode = "auto" | "base" | "handset";

function readLayout(key: string): AppLayoutMode {
  try {
    const v = localStorage.getItem(`apex.layout.${key}`);
    if (v === "base" || v === "handset") return v;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

export default function AppTopBar({
  title,
  subtitle,
  backTo,
  backLabel = "‹",
  storageKey,
  layout,
  onCycleLayout,
  onLayoutChange,
  children,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  storageKey: string;
  layout?: AppLayoutMode;
  onCycleLayout?: () => void;
  onLayoutChange?: (mode: AppLayoutMode) => void;
  children?: ReactNode;
}) {
  const [ownLayout, setOwnLayout] = useState<AppLayoutMode>("auto");
  useEffect(() => {
    const v = readLayout(storageKey);
    setOwnLayout(v);
    onLayoutChange?.(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const mode = layout ?? ownLayout;
  const cycle =
    onCycleLayout ??
    (() => {
      const next: AppLayoutMode = mode === "auto" ? "base" : mode === "base" ? "handset" : "auto";
      setOwnLayout(next);
      try {
        localStorage.setItem(`apex.layout.${storageKey}`, next);
      } catch {
        /* storage unavailable */
      }
      onLayoutChange?.(next);
    });

  const [appMode, setAppMode] = useState(false);
  const [badge, setBadge] = useState("/icons/icon-192.png");
  useEffect(() => {
    const host = hostInfo(window.location.hostname).app;
    setBadge(host === "mesh" ? "/icons/mesh-192.png" : host === "cb" || storageKey === "cb" ? "/icons/cb-192.png" : storageKey === "wx" || storageKey === "forecast" || storageKey === "doppler" || storageKey === "map" ? "/icons/wx-192.png" : storageKey === "uap" || storageKey === "ghost" || storageKey === "mystic" ? "/icons/icon-192.png" : "/icons/icon-192.png");
  }, [storageKey]);
  useEffect(() => {
    const onFs = () => setAppMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleAppMode = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <header className="z-10 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/90 face-pad py-1.5">
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Back"
          className="shrink-0 px-1 text-[24px] leading-none text-muted-foreground active:text-signal"
        >
          {backLabel}
        </Link>
      ) : (
        <span className="w-5 shrink-0" aria-hidden="true" />
      )}
      <div className="flex min-w-0 items-center gap-2">
        <img src={badge} alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 shrink-0 rounded-md border border-border object-cover" />
        <div className="min-w-0">
        <h1 className="truncate text-[14px] font-bold uppercase tracking-[0.2em] text-signal">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-[8px] uppercase tracking-[0.25em] text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={cycle}
          aria-label={`Layout: ${mode}. Change layout`}
          title="Auto follows rotation · Base = main view left, tools right · Handset = stacked"
          className="app-hbtn h-8 shrink-0 rounded-sm px-1.5 text-[11px] uppercase tracking-widest text-signal"
        >
          {mode === "base" ? "Base" : mode === "handset" ? "Handset" : "Auto"}
        </button>
        <button
          type="button"
          onClick={toggleAppMode}
          aria-label={appMode ? "Exit app mode (show the browser bar again)" : "Enter app mode (hide the browser bar)"}
          className="app-hbtn h-8 shrink-0 rounded-sm px-1.5 text-[11px] uppercase tracking-widest text-signal"
        >
          {appMode ? "Browser" : "App"}
        </button>
        {children}
        <InstallButton className="app-hbtn !w-auto !px-1.5 !py-1 !text-[11px]" />
      </div>
    </header>
  );
}
