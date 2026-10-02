import { TREMOR_BANDS, type TremorHop, tremorSummary } from "@/lib/tremor";

/**
 * Colour key for the tremor overlay. Without units the gradient is decoration;
 * this states the index band, the acceleration it maps to, and the live peak
 * so a reading on the face can actually be interpreted.
 */
export default function TremorLegend({
  hops,
  compact,
  onClose,
}: {
  hops: TremorHop[];
  compact?: boolean;
  onClose?: () => void;
}) {
  const { peak, mean, peakAccel } = tremorSummary(hops);

  return (
    <div className="pointer-events-auto rounded-md border border-border bg-background/85 p-1.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] uppercase tracking-widest text-signal">tremor · TI</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide tremor legend"
            className="text-[9px] leading-none text-muted-foreground active:text-signal"
          >
            ×
          </button>
        ) : null}
      </div>

      {/* Continuous scale bar */}
      <div
        className="mt-1 h-1.5 w-full rounded-sm"
        style={{
          background: `linear-gradient(to right, ${TREMOR_BANDS.map(
            (b) => `${b.hex} ${Math.round(b.min * 100)}%`,
          ).join(", ")})`,
        }}
        aria-hidden
      />

      {compact ? (
        <div className="mt-1 flex justify-between text-[7px] uppercase tracking-wider text-muted-foreground">
          <span>calm 0</span>
          <span>1 violent</span>
        </div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {TREMOR_BANDS.map((b) => (
            <li key={b.label} className="flex items-center gap-1.5 text-[8px] tracking-wider">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: b.hex }}
                aria-hidden
              />
              <span className="w-12 uppercase text-muted-foreground">{b.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {b.min.toFixed(1)}+ · {b.accel} m/s²
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 border-t border-border pt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
        {hops.length ? (
          <>
            peak <span className="text-signal tabular-nums">{peak.toFixed(2)}</span> · avg{" "}
            <span className="tabular-nums">{mean.toFixed(2)}</span> ·{" "}
            <span className="tabular-nums">{peakAccel.toFixed(2)} m/s²</span>
          </>
        ) : (
          "walk to sample tremor"
        )}
      </div>
    </div>
  );
}
