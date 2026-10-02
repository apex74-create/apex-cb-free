import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  inIndianSummerWindow,
  timelineLabelToIsoDate,
  type WaveTimelinePoint,
} from "@/services/forecastApi";

/**
 * Navigable forecast graph.
 *
 * Drag side to side to pan across dates, wheel / pinch to zoom the span.
 * Three marker sets are drawn together: measured history, the live current
 * reading, and the synthesis. The analog composite sits behind them as a
 * faint band showing what the matched ocean-state years actually did.
 */

type ForecastChartProps = {
  timeline: WaveTimelinePoint[];
  /** ISO date of the collapse peak; drawn as a vertical marker. */
  peakIso?: string | undefined;
  /** ISO bounds of the target window; falls back to the Indian Summer test. */
  windowStart?: string | undefined;
  windowEnd?: string | undefined;
  height?: number;
  /** Days visible before the user zooms. */
  initialSpan?: number;
  /** Projected nightly lows keyed by ISO date, plotted against the highs. */
  lows?: Array<{ iso: string; low_f: number }>;
};

function isoOf(point: WaveTimelinePoint): string {
  return point.iso ?? timelineLabelToIsoDate(point.date);
}

const MIN_SPAN = 3;

export default function ForecastChart({
  timeline,
  peakIso,
  windowStart,
  windowEnd,
  height = 208,
  initialSpan = 45,
  lows,
}: ForecastChartProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const lowByIso = useMemo(() => {
    const map = new Map<string, number>();
    for (const night of lows ?? []) map.set(night.iso, night.low_f);
    return map;
  }, [lows]);

  const rows = useMemo(
    () =>
      timeline.map((point) => {
        const iso = isoOf(point);
        const measured = point.observed ? point.temp : null;
        return {
          ...point,
          iso,
          measured,
          predicted: point.observed ? null : point.temp,
          low: lowByIso.get(iso) ?? null,
          current: iso === todayIso ? point.temp : null,
        };
      }),
    [timeline, todayIso, lowByIso],
  );

  const total = rows.length;
  const [view, setView] = useState({ start: 0, end: Math.min(total, initialSpan) });

  // Open on today when the data first lands, so the graph starts where it
  // matters — but only when the dataset itself changes. Keying off the row
  // array identity re-ran this on every parent render and silently undid the
  // user's panning and the today / peak / all buttons.
  const datasetKey = total ? `${total}:${rows[0]?.iso ?? ""}:${rows[total - 1]?.iso ?? ""}` : "";
  useEffect(() => {
    if (!total) return;
    const todayIndex = rows.findIndex((r) => r.iso >= todayIso);
    const anchor = todayIndex < 0 ? 0 : todayIndex;
    setView({ start: anchor, end: Math.min(total, anchor + initialSpan) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKey, todayIso, initialSpan]);


  const clamp = useCallback(
    (start: number, end: number) => {
      const span = Math.min(total, Math.max(MIN_SPAN, end - start));
      let s = Math.max(0, Math.min(start, total - span));
      const e = Math.min(total, s + span);
      s = Math.max(0, e - span);
      return { start: s, end: e };
    },
    [total],
  );

  const jumpTo = useCallback(
    (iso?: string) => {
      if (!iso || !total) return;
      const index = rows.findIndex((r) => r.iso >= iso);
      if (index < 0) return;
      // Jump with a working span, not the current one — when the whole
      // dataset fits on screen the buttons used to be dead because the
      // current span already covered everything.
      const span = Math.min(initialSpan, total);
      const start = iso === todayIso ? index : index - Math.floor(span / 2);
      setView(clamp(start, start + span));
    },
    [rows, total, initialSpan, clamp],
  );

  const drag = useRef<{ x: number; start: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, start: view.start };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const width = (e.currentTarget as HTMLElement).clientWidth || 1;
    const span = view.end - view.start;
    const shift = Math.round(((drag.current.x - e.clientX) / width) * span);
    const start = drag.current.start + shift;
    setView(clamp(start, start + span));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!total) return;
    const span = view.end - view.start;
    const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
    const next = Math.round(span * factor);
    const centre = view.start + span / 2;
    setView(clamp(Math.round(centre - next / 2), Math.round(centre + next / 2)));
  };

  const data = rows.slice(view.start, view.end);

  const inWindow = (point: { iso: string }) => {
    if (windowStart && windowEnd) return point.iso >= windowStart && point.iso <= windowEnd;
    return inIndianSummerWindow(point.iso);
  };
  const firstWindow = data.find(inWindow);
  const lastWindow = [...data].reverse().find(inWindow);
  const peakPoint = peakIso ? data.find((p) => p.iso === peakIso) : undefined;
  const hasAnalog = data.some((p) => typeof p.analog === "number");

  const span = view.end - view.start;
  const showsEverything = span >= total;
  const zoom = (factor: number) => {
    const next = Math.round(span * factor);
    const centre = view.start + span / 2;
    setView(clamp(Math.round(centre - next / 2), Math.round(centre + next / 2)));
  };
  const btn =
    "rounded-sm border border-border px-2 py-0.5 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="w-full">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {showsEverything
            ? `whole span shown · ${total} days · zoom in to scroll`
            : `${data[0]?.date ?? ""} – ${data[data.length - 1]?.date ?? ""} · ${span} of ${total} days`}
        </span>
        <span className="flex gap-1">
          <button type="button" onClick={() => zoom(1 / 1.6)} disabled={span <= MIN_SPAN} className={btn} aria-label="Zoom in">
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(1.6)}
            disabled={showsEverything}
            className={btn}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => jumpTo(todayIso)}
            disabled={total <= MIN_SPAN}
            className={btn}
          >
            today
          </button>
          <button
            type="button"
            onClick={() => jumpTo(peakIso)}
            disabled={total <= MIN_SPAN || !peakIso}
            className={btn}
          >
            peak
          </button>
          <button
            type="button"
            onClick={() => setView(clamp(0, total))}
            disabled={showsEverything}
            className={btn}
          >
            all
          </button>
        </span>
      </div>
      <div
        className="w-full touch-none select-none rounded-sm border border-border bg-card/60 p-2"
        style={{ height, cursor: drag.current ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
      >

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="iso" tickFormatter={(iso: string) => rows.find((r) => r.iso === iso)?.date ?? iso} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10 }}
              width={32}
              unit="°"
              domain={[
                (min: number) => Math.floor(min - 6),
                (max: number) => Math.ceil(max + 6),
              ]}
              allowDataOverflow={false}
            />
            {firstWindow && lastWindow ? (
              <ReferenceArea
                x1={firstWindow.iso}
                x2={lastWindow.iso}
                fill="var(--scan)"
                fillOpacity={0.14}
              />
            ) : null}
            
            {peakPoint ? (
              <ReferenceLine
                x={peakPoint.iso}
                stroke="var(--signal)"
                strokeDasharray="4 2"
                label={{
                  value: `${peakPoint.temp.toFixed(1)}°`,
                  position: "top",
                  fontSize: 9,
                  fill: "var(--signal)",
                }}
              />
            ) : null}
            <Tooltip
              contentStyle={{
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-card)",
                fontSize: "11px",
              }}
            />
            {hasAnalog ? (
              <Line
                type="linear"
                dataKey="analog"
                name="Analog years"
                stroke="var(--signal)"
                strokeOpacity={0.45}
                strokeWidth={3}
                dot={false}
                connectNulls
              />
            ) : null}
            <Line
              type="linear"
              dataKey="baseline"
              name="30-yr baseline"
              stroke="var(--muted-foreground, #94a3b8)"
              strokeDasharray="5 4"
              dot={false}
              strokeWidth={1.4}
            />
            <Line
              type="linear"
              dataKey="elNino"
              name="ENSO shifted"
              stroke="var(--scan)"
              strokeDasharray="2 3"
              dot={false}
              strokeWidth={1.2}
            />
            <Line
              type="linear"
              dataKey="measured"
              name="Measured"
              stroke="var(--scan)"
              strokeWidth={2.2}
              dot={{ r: 1.6 }}
              connectNulls
            />
            <Line
              type="linear"
              dataKey="predicted"
              name="Synthesized wave"
              stroke="var(--alert, #ef4444)"
              dot={false}
              strokeWidth={2.2}
              connectNulls
             />
             <Line
               type="linear"
               dataKey="low"
               name="Projected low"
               stroke="#22ff88"
               dot={{ r: 1.6 }}
               strokeWidth={2.2}
               connectNulls
             />
             <Line
               type="linear"
               dataKey="current"
               name="Today"
               stroke="var(--signal)"
               dot={{ r: 4 }}
               strokeWidth={0}
             />
           </LineChart>
         </ResponsiveContainer>
       </div>
       <div className="mt-1 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
         <span>— measured</span>
         <span style={{ color: "#ef4444" }}>— predicted high</span>
         <span style={{ color: "#22ff88" }}>— projected low</span>
         <span>— analog years</span>
         <span>— baseline</span>
       </div>
    </div>
  );
}
