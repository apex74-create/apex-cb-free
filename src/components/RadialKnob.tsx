import { useRef } from "react";
import { tapHaptic } from "@/lib/cb-feedback";

/**
 * A radio top-knob. Slide left/right across it (portrait) to roll it down/up;
 * the ridges rotate with the value. Arrow keys work too.
 */
export function RadialKnob({
  label,
  value,
  max,
  onChange,
  size = 44,
  haptics = false,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  size?: number;
  haptics?: boolean;
}) {
  const drag = useRef<{ x: number; v: number; step: number } | null>(null);
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(0, v)) * 20) / 20;
  const set = (v: number) => {
    const c = clamp(v);
    if (c !== value) {
      if (haptics) tapHaptic(8);
      onChange(c);
    }
  };
  const angle = -135 + (value / max) * 270;
  const pct = Math.round((value / max) * 100);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} volume`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, v: value, step: 0 };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          set(drag.current.v + ((e.clientX - drag.current.x) / 140) * max);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") set(value + max / 20);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(value - max / 20);
        }}
        className="cb-knob relative rounded-full border-2 border-warn"
        style={{ width: size, height: size, touchAction: "none" }}
      >
        <div className="absolute inset-0 rounded-full" style={{ transform: `rotate(${angle}deg)` }}>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2"
              style={{ transform: `rotate(${i * 30}deg)` }}
            >
              <span className="block h-[5px] w-full rounded-full bg-muted-foreground/60" />
            </span>
          ))}
          <span className="absolute left-1/2 top-[3px] h-[35%] w-[3px] -translate-x-1/2 rounded-full bg-warn" />
        </div>
      </div>
      <div aria-hidden="true" className="cb-knob-stem" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-warn">
        {label} {pct}
      </span>
    </div>
  );
}
