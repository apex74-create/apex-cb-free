import { useEffect, useState } from "react";
import { usePerfOverlayEnabled } from "@/lib/perf-overlay";

/**
 * Optional FPS + JS-heap overlay so the watch build can be proven smooth.
 * Toggled from Settings; state lives in localStorage so it survives a remount.
 */

type Heap = { used: number; limit: number } | null;

function readHeap(): Heap {
  const mem = (
    performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
  ).memory;
  if (!mem) return null;
  return { used: mem.usedJSHeapSize / 1048576, limit: mem.jsHeapSizeLimit / 1048576 };
}

export default function PerfOverlay() {
  const enabled = usePerfOverlayEnabled();
  const [fps, setFps] = useState(0);
  const [low, setLow] = useState(0);
  const [heap, setHeap] = useState<Heap>(null);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    let worst = 999;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        const value = Math.round((frames * 1000) / (now - last));
        setFps(value);
        worst = Math.min(worst, value);
        setLow(worst);
        setHeap(readHeap());
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  const tone = fps >= 45 ? "text-signal" : fps >= 25 ? "text-warn" : "text-alert";

  return (
    <div
      role="status"
      aria-label="Render performance"
      className="pointer-events-none fixed left-1 top-1 z-[9998] rounded-sm border border-border bg-background/80 px-1 py-0.5 text-[8px] leading-tight tracking-widest"
    >
      <span className={tone}>{fps} fps</span>
      <span className="text-muted-foreground"> · min {low === 999 ? "—" : low}</span>
      {heap ? (
        <span className="text-muted-foreground">
          {" "}
          · {heap.used.toFixed(0)}/{heap.limit.toFixed(0)} MB
        </span>
      ) : (
        <span className="text-muted-foreground"> · heap n/a</span>
      )}
    </div>
  );
}
