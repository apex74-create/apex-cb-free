import { useEffect, useState } from "react";

/**
 * Sextant overlay — pure SVG/DOM.
 *
 * The canvas face is not available on legacy watch WebViews, so the sighting
 * instrument is drawn with SVG (the one layer that always renders there).
 * Layout keeps the whole protractor and the compass rose in the upper two
 * thirds of the face: held in the palm in landscape, the bottom strip of the
 * screen is covered by the readout tiles and used to eat the first 45° of the
 * sweep.
 */
type Tilt = { alpha: number; beta: number; gamma: number };

export default function SextantOverlay({ heading }: { heading: number | null }) {
  const [tilt, setTilt] = useState<Tilt>({ alpha: 0, beta: 0, gamma: 0 });
  const [mag, setMag] = useState<number | null>(null);

  useEffect(() => {
    const onTilt = (e: DeviceOrientationEvent) => {
      setTilt({ alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 });
      const compass = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof compass === "number") setMag(compass);
      else if (typeof e.alpha === "number") setMag((360 - e.alpha) % 360);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, []);

  // Edge mount (watch turned on its side in the palm) sights on the roll axis.
  const edgeMount = Math.abs(tilt.gamma) > 45;
  const alt = Math.max(
    0,
    Math.min(90, edgeMount ? 90 - Math.abs(90 - Math.abs(tilt.gamma)) : 90 - Math.abs(tilt.beta)),
  );
  const az = (((heading ?? mag ?? 0) % 360) + 360) % 360;
  const card = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8];

  // Arc geometry in a 100x100 viewBox; vertex sits well above the bottom edge.
  const vx = 50;
  const vy = 74;
  const r = 40;
  const armA = Math.PI + (alt / 90) * (Math.PI / 2);
  const ax = vx + Math.cos(armA) * r;
  const ay = vy + Math.sin(armA) * r;

  const ticks = [];
  for (let d = 0; d <= 90; d += 5) {
    const a = Math.PI + (d / 90) * (Math.PI / 2);
    const major = d % 15 === 0;
    const r0 = r - (major ? 6 : 3);
    ticks.push(
      <line
        key={d}
        x1={+(vx + Math.cos(a) * r0).toFixed(3)}
        y1={+(vy + Math.sin(a) * r0).toFixed(3)}
        x2={+(vx + Math.cos(a) * r).toFixed(3)}
        y2={+(vy + Math.sin(a) * r).toFixed(3)}
        stroke="#00eeff"
        strokeOpacity={major ? 0.9 : 0.4}
        strokeWidth={major ? 0.9 : 0.4}
      />,
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[6]">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        {/* protractor */}
        <path
          d={`M ${vx - r} ${vy} A ${r} ${r} 0 0 1 ${vx} ${vy - r}`}
          fill="none"
          stroke="#00eeff"
          strokeOpacity="0.75"
          strokeWidth="0.8"
        />
        {ticks}
        <line
          x1={vx}
          y1={vy}
          x2={+ax.toFixed(3)}
          y2={+ay.toFixed(3)}
          stroke="#ffd60a"
          strokeWidth="1.1"
        />
        <circle cx={vx} cy={vy} r="1.8" fill="#ffd60a" />

        {/* compass rose, top-right, clear of the arc and the bottom tiles */}
        <g transform="translate(76,22)">
          <circle
            r="16"
            fill="rgba(2,8,14,0.7)"
            stroke="#00ff3b"
            strokeOpacity="0.5"
            strokeWidth="0.7"
          />
          <g transform={`rotate(${-az})`}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
              <line
                key={d}
                x1={0}
                y1={-16}
                x2={0}
                y2={d % 90 === 0 ? -11 : -13.5}
                stroke="#00ff3b"
                strokeOpacity={d % 90 === 0 ? 0.9 : 0.4}
                strokeWidth={d % 90 === 0 ? 0.9 : 0.4}
                transform={`rotate(${d})`}
              />
            ))}
            <text x="0" y="-6" textAnchor="middle" fontSize="6" fontWeight="700" fill="#ff2d6e">
              N
            </text>
            <path d="M0 -10 L2.6 2 L0 0 L-2.6 2 Z" fill="#ff2d6e" />
            <path d="M0 10 L2.6 -2 L0 0 L-2.6 -2 Z" fill="#00ff3b" fillOpacity="0.7" />
          </g>
        </g>
      </svg>

      {/* readouts as DOM text so they stay crisp and never distort */}
      <div className="absolute inset-x-0 top-[30%] text-center">
        <p className="text-[2.2rem] font-black leading-none tabular-nums text-warn drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
          {alt.toFixed(1)}°
        </p>
        <p className="mt-0.5 text-[7px] uppercase tracking-[0.25em] text-scan">
          {edgeMount ? "edge mount · sight altitude" : "top mount · sight altitude"}
        </p>
        <p className="mt-1 text-[13px] font-black tabular-nums text-signal">
          AZ {az.toFixed(0)}° {card}
        </p>
        <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
          {heading !== null || mag !== null ? "magnetic bearing" : "no magnetometer"}
        </p>
      </div>
    </div>
  );
}
