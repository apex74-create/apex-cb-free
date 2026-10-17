import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { rssiToMetres, type Fix, type GeometricValidation } from "@/lib/webperms";
import { solveConfidence, type HudAnchor } from "@/lib/trilateration-hud";

/**
 * Watch-sized plan view of the trilateration solve: range rings per live
 * companion, the solved point, its error radius, and a confidence bar.
 * Tapping a companion chip toggles whether it feeds the solve.
 */
export default function TrilaterationHUD({
  anchors,
  fix,
  onToggle,
}: {
  anchors: HudAnchor[];
  fix: Fix | null;
  onToggle: (id: string) => void;
}) {
  const active = anchors.filter((a) => a.enabled && a.rssi != null);
  const conf = solveConfidence(fix);

  const view = useMemo(() => {
    const pts: { x: number; y: number; r: number }[] = active.map((a) => ({
      x: a.x,
      y: a.y,
      r: rssiToMetres(a.rssi!),
    }));
    if (fix) pts.push({ x: fix.x, y: fix.y, r: Math.max(fix.radius, 1) });
    if (pts.length === 0) return { span: 10, cx: 0, cy: 0 };
    const span =
      Math.max(4, ...pts.map((p) => Math.abs(p.x) + p.r), ...pts.map((p) => Math.abs(p.y) + p.r)) *
      1.15;
    return { span, cx: 0, cy: 0 };
  }, [active, fix]);

  // SVG coordinate space: 100x100 box, centre at 50,50, y flipped.
  const sx = (m: number) => 50 + (m / view.span) * 46;
  const sy = (m: number) => 50 - (m / view.span) * 46;
  const sr = (m: number) => (m / view.span) * 46;

  const { svgRef, zoom, offset, reset, pointerHandlers } = usePinchZoom();

  return (
    <div className="rounded-sm border border-signal/50 bg-card/70 p-2">
      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h2 className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
          Solve HUD
        </h2>
        <span className="shrink-0 text-[8px] uppercase tracking-widest text-muted-foreground">
          {active.length} live · {view.span.toFixed(0)}m
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="mb-1.5 block w-full touch-none select-none"
        role="img"
        aria-label="Trilateration plan view"
        {...pointerHandlers}
      >
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth="0.4"
        />
        <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          <line
            x1="50"
            y1="2"
            x2="50"
            y2="98"
            className="text-border"
            stroke="currentColor"
            strokeWidth="0.3"
          />
          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
            className="text-border"
            stroke="currentColor"
            strokeWidth="0.3"
          />

          {active.map((a) => (
            <g key={a.id} className="text-scan">
              <circle
                cx={sx(a.x)}
                cy={sy(a.y)}
                r={sr(rssiToMetres(a.rssi!))}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="1.5 1.5"
                opacity="0.7"
              />
              <circle cx={sx(a.x)} cy={sy(a.y)} r="1.4" fill="currentColor" />
            </g>
          ))}

          {fix ? (
            <g className="text-warn">
              <circle
                cx={sx(fix.x)}
                cy={sy(fix.y)}
                r={Math.max(1, sr(fix.radius))}
                fill="currentColor"
                opacity="0.15"
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <line
                x1={sx(fix.x) - 4}
                y1={sy(fix.y)}
                x2={sx(fix.x) + 4}
                y2={sy(fix.y)}
                stroke="currentColor"
                strokeWidth="0.6"
              />
              <line
                x1={sx(fix.x)}
                y1={sy(fix.y) - 4}
                x2={sx(fix.x)}
                y2={sy(fix.y) + 4}
                stroke="currentColor"
                strokeWidth="0.6"
              />
            </g>
          ) : null}
        </g>
      </svg>
      <div className="mb-1.5 flex items-center justify-end gap-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        <span>{zoom.toFixed(1)}×</span>
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-border px-1.5 py-0.5 active:bg-accent"
        >
          reset
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-3 gap-1 text-center">
        <Stat
          label="fix"
          value={fix ? `${fix.x.toFixed(1)},${fix.y.toFixed(1)}` : "—"}
          tone="text-warn"
        />
        <Stat label="error" value={fix ? `±${fix.radius.toFixed(1)}m` : "—"} tone="text-alert" />
        <Stat label="conf" value={fix ? `${Math.round(conf * 100)}%` : "—"} tone="text-signal" />
      </div>

      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full bg-signal transition-[width]"
          style={{ width: `${Math.round(conf * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {anchors.length === 0 ? (
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
            no companions paired
          </p>
        ) : (
          anchors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              aria-pressed={a.enabled}
              className={`min-w-0 rounded-sm border px-1.5 py-0.5 text-left text-[8px] uppercase tracking-widest active:bg-accent ${
                a.enabled
                  ? "border-signal/60 text-signal"
                  : "border-border text-muted-foreground opacity-60"
              }`}
            >
              <span className="block max-w-[8rem] truncate">{a.name}</span>
              <span className="block text-[7px] text-muted-foreground">
                {a.rssi != null
                  ? `${a.rssi}dBm · ${rssiToMetres(a.rssi).toFixed(1)}m`
                  : "no report"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-sm border border-border px-1 py-0.5">
      <span className="block text-[7px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`block truncate text-[9px] tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wheel + trackpad pinch + two-finger touch pinch, plus drag-to-pan, in SVG user units. */
function usePinchZoom() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const state = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  state.current = { zoom, offset };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  /** Client coords → SVG user units (viewBox is 0 0 100 100). */
  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    const { zoom: z, offset: o } = state.current;
    const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const k = target / z;
    setZoom(target);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const p = toLocal(e.clientX, e.clientY);
      zoomAt(state.current.zoom * Math.exp(-dy * 0.0015), p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toLocal, zoomAt]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, toLocal(e.clientX, e.clientY));
    pinch.current = null;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const cur = toLocal(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, cur);

    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const a = pts[0]!;
      const b = pts[1]!;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const last = pinch.current;
      if (last && last.dist > 0.5) {
        zoomAt(state.current.zoom * (dist / last.dist), cx, cy);
        const o = state.current.offset;
        setOffset({ x: o.x + (cx - last.cx), y: o.y + (cy - last.cy) });
      }
      pinch.current = { dist, cx, cy };
      return;
    }

    const o = state.current.offset;
    setOffset({ x: o.x + (cur.x - prev.x), y: o.y + (cur.y - prev.y) });
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    svgRef,
    zoom,
    offset,
    reset,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
    },
  };
}
