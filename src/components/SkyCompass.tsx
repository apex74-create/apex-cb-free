import { useEffect, useMemo, useState } from "react";
import { compassPoint, moonPhase, moonPosition, sunPosition } from "@/lib/astro";
import { headingLabel, useHeading } from "@/lib/heading";

/**
 * Sun and moon on one horizon dial: north at the top, east to the right,
 * so the two bodies sit where they actually are relative to the observer.
 * Everything is computed on the device — no feed, works offline.
 */

type Props = { lat: number; lon: number };

const R = 86;
const CX = 100;
const CY = 100;

function point(azimuth: number, radius: number) {
  const a = (azimuth - 90) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

export default function SkyCompass({ lat, lon }: Props) {
  const [now, setNow] = useState(() => new Date());
  const facing = useHeading();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const { sun, moon, phase } = useMemo(
    () => ({
      sun: sunPosition(now, lat, lon),
      moon: moonPosition(now, lat, lon),
      phase: moonPhase(now.toISOString().slice(0, 10)),
    }),
    [now, lat, lon],
  );

  // Altitude pulls a body toward the centre: horizon at the rim, zenith at the hub.
  const radiusFor = (altitude: number) =>
    R * (1 - Math.max(0, Math.min(altitude, 90)) / 90) * (altitude < 0 ? 1.06 : 1);

  const sunAt = point(sun.azimuth, radiusFor(sun.altitude));
  const moonAt = point(moon.azimuth, radiusFor(moon.altitude));

  const cardinals: Array<[string, number]> = [
    ["N", 0],
    ["E", 90],
    ["S", 180],
    ["W", 270],
  ];

  return (
    <div className="rounded-sm border border-border bg-card/60 p-3">
      <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
        Sun &amp; moon compass
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img"
          aria-label={`Sun ${sun.azimuth} degrees, moon ${moon.azimuth} degrees`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" />
          <circle cx={CX} cy={CY} r={R * 0.5} fill="none" stroke="var(--border)" strokeDasharray="2 4" />
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="var(--border)" strokeDasharray="2 4" />
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="var(--border)" strokeDasharray="2 4" />
          {cardinals.map(([label, az]) => {
            const p = point(az, R + 9);
            return (
              <text
                key={label}
                x={p.x}
                y={p.y + 3}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 8, letterSpacing: 1 }}
              >
                {label}
              </text>
            );
          })}

          <line
            x1={CX}
            y1={CY}
            x2={sunAt.x}
            y2={sunAt.y}
            stroke="var(--warn)"
            strokeOpacity={sun.up ? 0.8 : 0.25}
          />
          <circle cx={sunAt.x} cy={sunAt.y} r={6} fill="var(--warn)" fillOpacity={sun.up ? 1 : 0.3} />

          <line
            x1={CX}
            y1={CY}
            x2={moonAt.x}
            y2={moonAt.y}
            stroke="var(--scan)"
            strokeOpacity={moon.up ? 0.8 : 0.25}
          />
          <circle cx={moonAt.x} cy={moonAt.y} r={5} fill="var(--scan)" fillOpacity={moon.up ? 1 : 0.3} />

          {facing.heading !== null ? (
            <line
              x1={CX}
              y1={CY}
              x2={point(facing.heading, R).x}
              y2={point(facing.heading, R).y}
              stroke="var(--signal)"
              strokeDasharray="4 3"
              strokeOpacity={0.7}
            />
          ) : null}

          <circle cx={CX} cy={CY} r={1.5} fill="var(--signal)" />
        </svg>

        <dl className="min-w-40 flex-1 space-y-1 text-[9px] uppercase tracking-widest">
          <div className="flex justify-between gap-3">
            <dt className="text-warn">Sun</dt>
            <dd className="text-muted-foreground">
              {compassPoint(sun.azimuth)} {sun.azimuth}° · {sun.altitude}°{" "}
              {sun.up ? "up" : "down"} · {sun.side === "east" ? "left of south" : "right of south"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-scan">Moon</dt>
            <dd className="text-muted-foreground">
              {compassPoint(moon.azimuth)} {moon.azimuth}° · {moon.altitude}°{" "}
              {moon.up ? "up" : "down"} ·{" "}
              {moon.side === "east" ? "left of south" : "right of south"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Phase</dt>
            <dd className="text-muted-foreground">
              {phase.label} · {Math.round(phase.illumination * 100)}% lit
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Separation</dt>
            <dd className="text-muted-foreground">
              {Math.round(Math.abs(((sun.azimuth - moon.azimuth + 540) % 360) - 180))}° apart
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Observed</dt>
            <dd className="text-muted-foreground">
              {now.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Facing</dt>
            <dd className="text-muted-foreground">
              {facing.heading === null
                ? headingLabel(facing.source)
                : `${compassPoint(facing.heading)} ${Math.round(facing.heading)}° · ${headingLabel(facing.source)}`}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-muted-foreground">
              {lat.toFixed(2)}, {lon.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-2 text-[8px] uppercase tracking-widest text-muted-foreground">
        North at the top, east to the right. Rim is the horizon, centre is straight overhead; a
        dimmed marker is below the horizon. Computed on the device — no network needed.
      </p>
    </div>
  );
}
