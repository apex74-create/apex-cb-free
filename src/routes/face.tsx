import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ApexFace from "@/components/ApexFace";
import SuperpositionGyro from "@/components/SuperpositionGyro";
import SovereignBadge from "@/components/SovereignBadge";
import SextantOverlay from "@/components/SextantOverlay";

import { useBridge } from "@/lib/bridge-context";
import { headingLabel, useHeading } from "@/lib/heading";
import { parseScanResults, useLiveCommand } from "@/lib/live-data";

export const Route = createFileRoute("/face")({
  head: () => ({
    meta: [
      { title: "Apex Face — Live Signal Watch Face" },
      {
        name: "description",
        content:
          "Animated Apex watch face: pulsing signal gauge, spinning dorito and octahedron, edge compass and live onboard sensor readouts.",
      },
      { property: "og:title", content: "Apex Face — Live Signal Watch Face" },
      {
        property: "og:description",
        content:
          "Circuit-board watch face with a live RF gauge, compass ring and constantly updating sensor data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // The sextant protractor is an opt-in overlay selected from the index.
  validateSearch: (search: Record<string, unknown>): { sextant?: boolean } => {
    const v = search["sextant"];
    const on = v === true || v === "true" || v === "1";
    return on ? { sextant: true } : {};
  },
  component: FaceView,
});

/** Local sensors the watch itself exposes to the browser. */
function useWatchSensors() {
  const [tilt, setTilt] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [clock, setClock] = useState(() => new Date());
  // Shared source: magnetometer where it exists, course over ground where it
  // does not, so a compass-less watch still shows a real bearing when moving.
  const bearing = useHeading();

  useEffect(() => {
    let timer = 0;
    let latest: { alpha: number; beta: number; gamma: number } | null = null;
    const commit = () => {
      timer = 0;
      const next = latest;
      if (!next) return;
      setTilt({ alpha: next.alpha, beta: next.beta, gamma: next.gamma });
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      latest = { alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 };
      if (!timer) timer = window.setTimeout(commit, 66);
    };
    window.addEventListener("deviceorientation", onTilt);
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.removeEventListener("deviceorientation", onTilt);
      if (timer) window.clearTimeout(timer);
      clearInterval(t);
    };
  }, []);

  return { tilt, heading: bearing.heading, headingSource: bearing.source, clock };
}

const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];
/** 16-point cardinal index for an azimuth in degrees. */
function cardinal(deg: number) {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]!;
}

function FaceView() {
  const { state } = useBridge();
  const { sextant = false } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { tilt, heading, headingSource, clock } = useWatchSensors();
  /** Sextant-style altitude above the horizon from the pitch sensor. */
  const altitude = Math.max(-90, Math.min(90, 90 - Math.abs(tilt.beta)));

  // Real field strength from the phone's beacon sweep — no synthetic value.
  const scan = useLiveCommand("shell cmd wifi list-scan-results", parseScanResults, 8000);
  const top = scan.data?.[0] ?? null;
  const strength = top ? Math.min(1, Math.max(0.05, (top.rssi + 100) / 60)) : 0.28;

  const hhmm = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const secs = String(clock.getSeconds()).padStart(2, "0");

  return (
    <main className="relative h-app w-full overflow-hidden bg-background">
      {/* On a phone/tablet the face keeps its square stage centred instead of
          stretching to a tall viewport, which squashed the gauge and tiles. */}
      <div className="face-stage relative mx-auto h-full w-full">
        <ApexFace signal={{ strength, heading }} sextant={sextant} />
        {sextant ? <SextantOverlay heading={heading} /> : null}

        <div className="relative z-10 flex h-full flex-col face-pad py-2">
          <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <Link
              to="/app"
              aria-label="Back to gallery"
              className="px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
            >
              ‹
            </Link>
            <h1 className="min-w-0 truncate text-center text-[9px] font-bold uppercase tracking-[0.25em] text-signal">
              Apex Face
            </h1>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void navigate({ search: sextant ? {} : { sextant: true } })}
                aria-pressed={sextant}
                className={`rounded-sm border px-1 py-0.5 text-[7px] uppercase tracking-widest ${
                  sextant
                    ? "border-scan bg-scan/15 text-scan"
                    : "border-border text-muted-foreground"
                }`}
              >
                sxt
              </button>
              <span
                className={`text-[8px] uppercase tracking-widest ${state === "online" ? "text-signal" : "text-warn"}`}
              >
                {state === "online" ? "link" : "solo"}
              </span>
            </div>
          </header>
          <div className="flex justify-center pt-1">
            <SovereignBadge />
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {/* Superposition gyro: drag to spin, tilt for parallax, locks + flashes when level. */}
            <div className="absolute inset-0">
              <SuperpositionGyro strength={strength} />
            </div>
            {!sextant ? (
              <div className="pointer-events-none relative text-center">
                <p
                  suppressHydrationWarning
                  className="text-[2.6rem] font-bold leading-none tracking-tight text-foreground tabular-nums drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]"
                >
                  {hhmm}
                  <span
                    suppressHydrationWarning
                    className="ml-1 align-top text-[0.9rem] text-signal"
                  >
                    {secs}
                  </span>
                </p>
                <p
                  suppressHydrationWarning
                  className="mt-0.5 text-[8px] uppercase tracking-[0.3em] text-muted-foreground"
                >
                  {clock.toLocaleDateString([], {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </div>
            ) : null}
          </div>

          {sextant ? (
            // Sighting mode: one slim line instead of the tile block, so the
            // protractor and the compass are never covered in landscape.
            <p className="pb-1 text-center text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
              heel {tilt.gamma.toFixed(0)}° · α {tilt.alpha.toFixed(0)}° ·{" "}
              {top ? `${top.rssi} dBm` : "no sweep"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1 pb-1">
              <Box
                label="rf"
                tone="text-signal"
                value={top ? `${top.rssi} dBm` : "—"}
                sub={top?.ssid ?? "no sweep"}
              />
              <Box
                label="sextant"
                tone="text-scan"
                value={`alt ${altitude.toFixed(1)}°`}
                sub={`heel ${tilt.gamma.toFixed(0)}° · α ${tilt.alpha.toFixed(0)}°`}
              />
              <Box
                label="azimuth"
                tone="text-warn"
                value={
                  heading === null
                    ? "—"
                    : `${cardinal(heading)} ${heading.toFixed(0).padStart(3, "0")}°`
                }
                sub={headingLabel(headingSource)}
              />
              <Box
                label="field"
                tone="text-alert"
                value={`${Math.round(strength * 100)}%`}
                sub={scan.error ? "solo mode" : `${scan.data?.length ?? 0} emitters`}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Box({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-background/70 px-1.5 py-1 backdrop-blur-[1px]">
      <p className={`truncate text-[7px] uppercase tracking-[0.2em] ${tone}`}>{label}</p>
      <p className="truncate text-[10px] font-bold tabular-nums text-foreground">{value}</p>
      <p className="truncate text-[7px] uppercase tracking-wider text-muted-foreground">{sub}</p>
    </div>
  );
}
