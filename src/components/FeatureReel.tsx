import { Link } from "@tanstack/react-router";
import { FEATURES, featureIndex, type Feature } from "@/lib/features";
import { toneBorder, toneClass } from "@/lib/tools";

function Demo({ slide }: { slide: Feature }) {
  const stroke = `var(--${slide.tone === "green" ? "signal" : slide.tone === "amber" ? "warn" : slide.tone === "red" ? "alert" : "scan"})`;
  return (
    <svg
      viewBox="0 0 100 52"
      className="h-full w-full"
      role="img"
      aria-label={`${slide.title} preview`}
    >
      <g stroke={stroke} fill="none" strokeWidth="0.6" opacity="0.85">
        {slide.demo === "bridge" ? (
          <>
            <rect x="8" y="16" width="18" height="20" rx="2" />
            <rect x="41" y="12" width="18" height="28" rx="2" />
            <rect x="74" y="18" width="18" height="16" rx="2" />
            <path d="M26 26 H41 M59 26 H74" strokeDasharray="3 3" className="reel-dash" />
          </>
        ) : slide.demo === "capture" ? (
          <>
            <rect x="10" y="10" width="80" height="32" rx="2" opacity="0.4" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M${16 + i * 16} 38 V${34 - i * 5}`} strokeWidth="1.6" />
            ))}
            <path d="M10 44 H90" strokeDasharray="3 3" className="reel-dash" />
          </>
        ) : slide.demo === "mesh-chat" ? (
          <>
            <rect x="10" y="12" width="34" height="14" rx="3" />
            <rect x="56" y="26" width="34" height="14" rx="3" />
            <path d="M44 19 C52 19 48 33 56 33" strokeDasharray="2 3" className="reel-dash" />
            <circle cx="50" cy="26" r="1.6" fill={stroke} />
          </>
        ) : slide.demo === "hardware" ? (
          <>
            <rect x="30" y="14" width="40" height="24" rx="2" />
            {[18, 26, 34].map((y) => (
              <path key={y} d={`M30 ${y} H18 M70 ${y} H82`} />
            ))}
            <circle cx="50" cy="26" r="4" className="reel-pulse" />
          </>
        ) : slide.demo === "admin" ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <circle
                  cx="18"
                  cy={12 + i * 9}
                  r="2.4"
                  fill={i < 3 ? stroke : "none"}
                  fillOpacity="0.6"
                />
                <path d={`M26 ${12 + i * 9} H${78 - i * 8}`} />
              </g>
            ))}
          </>
        ) : slide.demo === "settings" ? (
          <>
            {[14, 26, 38].map((y, i) => (
              <g key={y}>
                <path d={`M14 ${y} H86`} opacity="0.5" />
                <circle cx={26 + i * 24} cy={y} r="3" fill={stroke} fillOpacity="0.5" />
              </g>
            ))}
          </>
        ) : slide.demo === "panel" ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="12" y={10 + i * 9} width={70 - i * 12} height="5" rx="1" />
            ))}
          </>
        ) : slide.demo === "trail" ? (
          <path d="M10 42 C30 38 28 18 46 16 C64 14 70 32 90 24" className="reel-draw" />
        ) : slide.demo === "rf" ? (
          <>
            {[6, 12, 18].map((r) => (
              <circle key={r} cx="50" cy="26" r={r} className="reel-pulse" />
            ))}
            <circle cx="50" cy="26" r="1.6" fill={stroke} />
          </>
        ) : slide.demo === "tetra" ? (
          <>
            <path d="M50 8 L86 44 L14 44 Z" />
            <path d="M50 8 L50 44 M14 44 L86 8" strokeDasharray="2 3" opacity="0.5" />
            <circle cx="50" cy="32" r="2" fill={stroke} />
          </>
        ) : (
          <>
            {[8, 15, 22].map((r) => (
              <circle key={r} cx="50" cy="26" r={r} opacity="0.4" />
            ))}
            {[
              [30, 16],
              [70, 20],
              [62, 40],
              [36, 38],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r="2.4" fill={stroke} fillOpacity="0.5" />
                {slide.demo !== "ssid" && (
                  <path
                    d={`M50 26 L${x} ${y}`}
                    opacity="0.35"
                    strokeDasharray={slide.demo === "pcap" ? "2 3" : undefined}
                  />
                )}
              </g>
            ))}
            <circle cx="50" cy="26" r="2" fill={stroke} />
          </>
        )}
      </g>
    </svg>
  );
}

/**
 * The walkthrough is URL-addressable: the visible slide is driven by the
 * `?feature=<slug>` search param, so any card can be shared or bookmarked,
 * and "open" deep-links to that feature's own full-screen route.
 */
export default function FeatureReel({
  slug,
  onSelect,
}: {
  slug?: string | undefined;
  onSelect: (slug: string) => void;
}) {
  const i = featureIndex(slug);
  const slide = FEATURES[i]!;
  const go = (d: number) => onSelect(FEATURES[(i + d + FEATURES.length) % FEATURES.length]!.slug);

  return (
    <section className="grid content-between gap-2">
      <div
        className={`grid gap-1.5 rounded-sm border ${toneBorder[slide.tone]} bg-card/70 p-2`}
        key={slide.slug}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className={`text-lg leading-none ${toneClass[slide.tone]}`}>{slide.glyph}</span>
          <span className="min-w-0">
            <span
              className={`block truncate text-[11px] font-bold uppercase tracking-widest ${toneClass[slide.tone]}`}
            >
              {slide.title}
            </span>
            <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
              {slide.sub}
            </span>
          </span>
        </div>

        <div className="h-14 rounded-sm border border-border/60 bg-background/60">
          <Demo slide={slide} />
        </div>

        <p className="text-[9px] leading-snug text-muted-foreground">{slide.blurb}</p>

        <Link
          to={slide.target.to}
          params={("params" in slide.target ? slide.target.params : undefined) as never}
          className={`rounded-sm border ${toneBorder[slide.tone]} px-2 py-1 text-center text-[9px] font-bold uppercase tracking-widest ${toneClass[slide.tone]} active:bg-accent`}
        >
          Open {slide.title}
        </Link>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous feature"
          className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground active:bg-accent"
        >
          ‹
        </button>
        <span className="text-center text-[8px] uppercase tracking-widest text-muted-foreground">
          {i + 1} / {FEATURES.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next feature"
          className="rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground active:bg-accent"
        >
          ›
        </button>
      </div>
    </section>
  );
}
