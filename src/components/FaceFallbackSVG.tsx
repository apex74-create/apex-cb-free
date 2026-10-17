/**
 * SVG rendition of the Apex face.
 *
 * Used on watch WebViews whose canvas layer never paints (AOSP 10 LOKMAT).
 * SVG + CSS render there perfectly, so the circuit substrate, signal rings and
 * compass bezel are rebuilt with plain shapes and the animation classes that
 * already live in styles.css.
 */
type Props = {
  strength?: number;
  heading?: number | null;
  className?: string;
};

const TRACES = [
  "M2 26 H30 L40 16 H74 L84 26 H98",
  "M2 50 H22 L34 62 H66 L78 50 H98",
  "M2 74 H26 L38 84 H62 L74 74 H98",
  "M26 2 V22 L36 32 V68 L26 78 V98",
  "M74 2 V20 L64 30 V70 L74 80 V98",
];

const PADS = [
  [26, 26],
  [74, 26],
  [26, 74],
  [74, 74],
  [50, 18],
  [50, 82],
];

export default function FaceFallbackSVG({ strength = 0.3, heading = null, className }: Props) {
  const s = Math.min(1, Math.max(0.05, strength));
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  const coord = (n: number) => n.toFixed(4);

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "absolute inset-0 h-full w-full"}
    >
      <defs>
        <radialGradient id="apex-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0d3a24" />
          <stop offset="55%" stopColor="#061c12" />
          <stop offset="100%" stopColor="#010804" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill="url(#apex-glow)" />

      {/* board grid */}
      <g stroke="#00ff3b" strokeOpacity="0.08" strokeWidth="0.3">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} />
        ))}
      </g>

      {/* copper traces */}
      <g fill="none" stroke="#00ff3b" strokeOpacity="0.5" strokeWidth="0.6" strokeLinecap="square">
        {TRACES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        fill="none"
        stroke="#00eeff"
        strokeOpacity="0.55"
        strokeWidth="0.5"
        strokeDasharray="3 5"
        className="reel-dash"
      >
        {TRACES.map((d) => (
          <path key={`f${d}`} d={d} />
        ))}
      </g>

      {/* solder pads */}
      <g>
        {PADS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r="1.8"
              fill="none"
              stroke="#00ff3b"
              strokeOpacity="0.6"
              strokeWidth="0.4"
            />
            <circle cx={x} cy={y} r="0.7" fill="#00ff3b" fillOpacity="0.8" className="reel-pulse" />
          </g>
        ))}
      </g>

      {/* signal rings — radius tracks live strength */}
      <g fill="none" stroke="#00ff3b" strokeWidth="0.5">
        <circle cx="50" cy="50" r={14 + s * 8} strokeOpacity="0.55" className="reel-pulse" />
        <circle cx="50" cy="50" r={24 + s * 12} strokeOpacity="0.3" />
        <circle cx="50" cy="50" r={34 + s * 10} strokeOpacity="0.16" />
      </g>

      {/* octahedron wireframe */}
      <g stroke="#00eeff" strokeOpacity="0.7" strokeWidth="0.5" fill="none">
        <path d="M50 32 L64 50 L50 68 L36 50 Z" />
        <path d="M50 32 L50 68 M36 50 L64 50" strokeOpacity="0.35" />
        <path d="M50 32 L58 44 L50 50 L42 44 Z" stroke="#00ff3b" strokeOpacity="0.5" />
      </g>

      {/* compass bezel */}
      <g transform={`rotate(${-(heading ?? 0)} 50 50)`}>
        {ticks.map((deg) => {
          const major = deg % 90 === 0;
          const r1 = major ? 42 : 45;
          const rad = ((deg - 90) * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={coord(50 + Math.cos(rad) * r1)}
              y1={coord(50 + Math.sin(rad) * r1)}
              x2={coord(50 + Math.cos(rad) * 48)}
              y2={coord(50 + Math.sin(rad) * 48)}
              stroke={major ? "#00ff3b" : "#00ff3b"}
              strokeOpacity={major ? 0.9 : 0.35}
              strokeWidth={major ? 0.8 : 0.4}
            />
          );
        })}
      </g>
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="#00ff3b"
        strokeOpacity="0.25"
        strokeWidth="0.4"
      />
    </svg>
  );
}
