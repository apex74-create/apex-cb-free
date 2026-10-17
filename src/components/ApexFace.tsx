import { useEffect, useRef, useState } from "react";
import { getAnchor, getAttitude } from "@/lib/gyro-bus";
import {
  canvas2dWorks,
  markCanvasBroken,
  isLegacyWebView,
  resetCanvasProbe,
  shouldUseStableSvg,
} from "@/lib/canvas-support";
import { retryDelay, useRenderTuning } from "@/lib/render-tuning";
import {
  armSafeMode,
  clearSafeMode,
  deviceClass,
  isSafeMode,
  reportRender,
  watchLoadErrors,
} from "@/lib/render-diagnostics";
import RenderDiagnostics from "@/components/RenderDiagnostics";

import FaceFallbackSVG from "@/components/FaceFallbackSVG";

/**
 * Apex domain protocol watch face.
 *
 * Everything is drawn on one canvas so a 400x400 AMOLED face can run it at
 * 60fps without a DOM node per element:
 *  - circuit-board substrate (deterministic traces + pads)
 *  - pulsing signal ring gauge driven by a live strength value
 *  - spinning "dorito" triangle + signal-ring octahedron wireframe
 *  - compass rose ticks marching around the square edge
 *  - superposition probability lobes
 */

export type FaceSignal = {
  /** 0..1 field strength — drives the gauge sweep and pulse rate. */
  strength: number;
  /** Magnetic heading in degrees, if the watch reports one. */
  heading: number | null;
};

type Props = {
  signal: FaceSignal;
  /** Dim the whole face so it can sit behind readable UI. */
  ambient?: boolean;
  /** Draw the protractor-style sextant overlay (selected from the index). */
  sextant?: boolean;
  className?: string;
};

const TAU = Math.PI * 2;

/** Deterministic PRNG so the circuit substrate never re-shuffles per frame. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

type Trace = {
  x: number;
  y: number;
  pts: [number, number][];
  pad: boolean;
  phase: number;
  /** Bold bus runs vs hair-thin signal runs. */
  bold: boolean;
  /** Cumulative length at each point, plus the total, for pulse travel. */
  cum: number[];
  len: number;
  /** Seconds for one pulse to traverse the run. */
  period: number;
  /** Board layer: 0 = deepest inner plane, 2 = top copper. */
  layer: number;
};

function buildTraces(w: number, h: number): Trace[] {
  const r = rng(0x4a3f21);
  const traces: Trace[] = [];
  const step = Math.max(14, Math.min(w, h) / 16);
  for (let i = 0; i < 46; i++) {
    const x = Math.round((r() * w) / step) * step;
    const y = Math.round((r() * h) / step) * step;
    const pts: [number, number][] = [[x, y]];
    let cx = x;
    let cy = y;
    const legs = 2 + Math.floor(r() * 3);
    for (let l = 0; l < legs; l++) {
      const len = step * (1 + Math.floor(r() * 3));
      if (r() > 0.5) cx += r() > 0.5 ? len : -len;
      else cy += r() > 0.5 ? len : -len;
      pts.push([cx, cy]);
    }
    const cum = [0];
    for (let p = 1; p < pts.length; p++) {
      cum.push(cum[p - 1]! + Math.hypot(pts[p]![0] - pts[p - 1]![0], pts[p]![1] - pts[p - 1]![1]));
    }
    traces.push({
      x,
      y,
      pts,
      pad: r() > 0.45,
      phase: r() * TAU,
      bold: r() > 0.62,
      cum,
      len: cum[cum.length - 1] || 1,
      period: 1.6 + r() * 2.6,
      layer: Math.floor(r() * 3),
    });
  }
  return traces;
}

/**
 * A chip package that assembles itself onto the board:
 * slides in on X, locks, slides in on Y, locks, floats in Z, then drops back
 * through the dimensional hole so the next one can build on top of it.
 */
type Chip = {
  /** Locked resting slot. */
  sx: number;
  sy: number;
  w: number;
  h: number;
  pins: number;
  layer: number;
  phase: number;
  /** Seconds before this chip first enters, and its full assemble cycle. */
  birth: number;
  cycle: number;
  /** Entry travel offsets for the X then Y slide legs. */
  fromX: number;
  fromY: number;
};

/** Multi-conductor bus bundle wiring two chips together on the same layer. */
type Bus = {
  ai: number;
  bi: number;
  lanes: number;
  layer: number;
  phase: number;
  period: number;
};

/** Live pose of a chip inside its slide → lock → float → drop cycle. */
type ChipPose = {
  x: number;
  y: number;
  /** Height above the board: >0 floats toward the viewer, <0 falls in the hole. */
  z: number;
  alpha: number;
  /** 0..1 how firmly the package is seated (drives the lock flash). */
  lock: number;
};

function chipPose(chip: Chip, t: number): ChipPose {
  const p = ((((t - chip.birth) / chip.cycle) % 1) + 1) % 1;
  const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);

  // 0.00–0.10 rise out of the hole · 0.10–0.32 slide X · 0.32–0.52 slide Y
  // 0.52–0.86 locked, floating in Z · 0.86–1.00 drop back through the hole
  if (p < 0.1) {
    const u = ease(p / 0.1);
    return {
      x: chip.sx + chip.fromX,
      y: chip.sy + chip.fromY,
      z: -160 + 160 * u,
      alpha: u * 0.9,
      lock: 0,
    };
  }
  if (p < 0.32) {
    const u = ease((p - 0.1) / 0.22);
    return {
      x: chip.sx + chip.fromX * (1 - u),
      y: chip.sy + chip.fromY,
      z: 26,
      alpha: 0.9,
      lock: 0,
    };
  }
  if (p < 0.52) {
    const u = ease((p - 0.32) / 0.2);
    return {
      x: chip.sx,
      y: chip.sy + chip.fromY * (1 - u),
      z: 26 - 26 * u,
      alpha: 0.95,
      lock: u * 0.6,
    };
  }
  if (p < 0.86) {
    const u = (p - 0.52) / 0.34;
    return {
      x: chip.sx,
      y: chip.sy,
      // seated, then breathing in Z on top of the stack it just joined
      z: Math.sin(u * TAU) * 9,
      alpha: 1,
      lock: 1 - Math.min(1, u * 2.4) * 0.4,
    };
  }
  const u = ease((p - 0.86) / 0.14);
  return {
    x: chip.sx,
    y: chip.sy,
    z: -260 * u,
    alpha: 1 - u,
    lock: 0,
  };
}

/** Chip packages + the bus bundles wiring them together, per layer. */
function buildChips(w: number, h: number): { chips: Chip[]; buses: Bus[] } {
  const r = rng(0x1d77c3);
  const chips: Chip[] = [];
  const buses: Bus[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = 3 - Math.floor(layer / 2);
    const idx: number[] = [];
    for (let i = 0; i < count; i++) {
      const cw = Math.min(w, h) * (0.13 + r() * 0.12);
      const ch = cw * (0.55 + r() * 0.5);
      idx.push(chips.length);
      chips.push({
        sx: w * (0.14 + r() * 0.72) - cw / 2,
        sy: h * (0.14 + r() * 0.72) - ch / 2,
        w: cw,
        h: ch,
        pins: 4 + Math.floor(r() * 4),
        layer,
        phase: r() * TAU,
        birth: r() * 12,
        cycle: 11 + r() * 7,
        fromX: (r() > 0.5 ? 1 : -1) * (w * (0.5 + r() * 0.5)),
        fromY: (r() > 0.5 ? 1 : -1) * (h * (0.4 + r() * 0.5)),
      });
    }
    for (let i = 0; i < idx.length; i++) {
      const ai = idx[i]!;
      const bi = idx[(i + 1) % idx.length]!;
      if (ai === bi) continue;
      buses.push({
        ai,
        bi,
        lanes: 3 + Math.floor(r() * 3),
        layer,
        phase: r() * TAU,
        period: 1.8 + r() * 2.2,
      });
    }
  }
  return { chips, buses };
}

/** Point at a given distance along a polyline. */
function alongTrace(tr: Trace, dist: number): [number, number] {
  const d = ((dist % tr.len) + tr.len) % tr.len;
  for (let i = 1; i < tr.cum.length; i++) {
    if (d <= tr.cum[i]!) {
      const seg = tr.cum[i]! - tr.cum[i - 1]! || 1;
      const f = (d - tr.cum[i - 1]!) / seg;
      const [ax, ay] = tr.pts[i - 1]!;
      const [bx, by] = tr.pts[i]!;
      return [ax + (bx - ax) * f, ay + (by - ay) * f];
    }
  }
  return tr.pts[tr.pts.length - 1]!;
}

export default function ApexFace({ signal, ambient = false, sextant = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sigRef = useRef(signal);
  sigRef.current = signal;
  const tiltRef = useRef({ beta: 0, gamma: 0, alpha: 0 });
  /** Smoothed 0..1 "the device is lying flat" value; drives the bezel lock. */
  const lockRef = useRef(0);
  /** 1 at the instant lock is acquired, decays — drives the ring/hex flash. */
  const flashRef = useRef(0);
  const lockedRef = useRef(false);
  /** Without a real sensor there is nothing to level, so never claim a lock. */
  const sensorRef = useRef(false);

  useEffect(() => {
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta !== null || e.gamma !== null) sensorRef.current = true;
      tiltRef.current = { beta: e.beta ?? 0, gamma: e.gamma ?? 0, alpha: e.alpha ?? 0 };
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, []);

  /** User-tunable watchdog / retry values (device defaults, no code edits). */
  const { tuning } = useRenderTuning();
  /** True when this WebView's canvas layer never paints (AOSP watch builds). */
  // SVG-first boot is deliberate: never put a canvas into an unprobed watch
  // compositor, even for the single frame between hydration and useEffect.
  const [fallback, setFallback] = useState(true);
  /** Flips true only once the draw loop has completed a real frame. */
  const [painted, setPainted] = useState(false);
  const paintedRef = useRef(false);
  /** Remount counter: bumping it throws away the dead canvas and re-probes. */
  const [attempt, setAttempt] = useState(0);
  /** Set by the load-error guard: SVG only until the next retry window. */
  const [safe, setSafe] = useState(false);
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = performance.now();
    if (isSafeMode()) setSafe(true);
    const probe = canvas2dWorks();
    setFallback(!probe);
    reportRender(
      {
        deviceClass: deviceClass(),
        legacy: isLegacyWebView(),
        probe,
        attempt,
        pathway: probe ? "probing" : "svg",
        firstFrameMs: null,
      },
      `attempt ${attempt} · probe ${probe ? "ok" : "fail"}`,
    );
  }, [attempt]);

  // Screen sleep: a watch WebView keeps a stalled canvas after the panel
  // wakes, which froze the face and swallowed taps. Drop to the SVG face while
  // hidden, then start a fresh canvas on wake; the frame watchdog falls back to
  // SVG if that fresh canvas never paints.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        setFallback(true);
        return;
      }
      if (shouldUseStableSvg() || isSafeMode()) return;
      resetCanvasProbe(true);
      paintedRef.current = false;
      setPainted(false);
      setFallback(false);
      setAttempt((a) => a + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Safety fallback: any uncaught error during the initial load window means
  // the face may be coming up on a half-broken compositor. Drop straight to
  // the SVG pathway, then let the normal retry window re-arm the canvas.
  useEffect(() => {
    const guardMs = tuning.watchdogMs + retryDelay(tuning, 0);
    return watchLoadErrors(guardMs, (reason) => {
      armSafeMode(reason);
      setSafe(true);
      setFallback(true);
    });
  }, [tuning]);

  // Automatic recovery from safe mode: after one retry window the canvas is
  // re-armed and re-probed, so a one-off boot error never sticks.
  useEffect(() => {
    if (!safe) return;
    // Watch WebViews stay on the SVG face. Re-inserting a canvas here was the
    // source of the render-then-black-screen loop.
    if (shouldUseStableSvg()) return;
    const t = setTimeout(
      () => {
        clearSafeMode();
        resetCanvasProbe(true);
        setSafe(false);
        paintedRef.current = false;
        setPainted(false);
        setFallback(false);
        setAttempt((a) => a + 1);
      },
      retryDelay(tuning, attempt),
    );
    return () => clearTimeout(t);
  }, [safe, attempt, tuning]);

  // Auto-retry: a watch WebView that misses its very first frames (compositor
  // or layout not ready on cold boot) often paints fine on a fresh canvas a
  // couple of seconds later. Retry with the configured backoff, then stay on
  // SVG. Genuinely legacy WebViews are never retried — canvas there is fatal.
  useEffect(() => {
    if (safe) return;
    if (!fallback || attempt >= tuning.maxRetries) return;
    if (shouldUseStableSvg()) return;
    const t = setTimeout(
      () => {
        resetCanvasProbe(true);
        paintedRef.current = false;
        setPainted(false);
        setFallback(false);
        setAttempt((a) => a + 1);
      },
      retryDelay(tuning, attempt),
    );
    return () => clearTimeout(t);
  }, [safe, fallback, attempt, tuning]);

  useEffect(() => {
    if (fallback || safe) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let traces: Trace[] = [];
    let chips: Chip[] = [];
    let buses: Bus[] = [];
    let w = 0;
    let h = 0;
    let canvasLeft = 0;
    let canvasTop = 0;

    /**
     * The board substrate never animates — only its size changes. Painting
     * six full-canvas gradients every frame is what made the live face crawl
     * on a high-DPR handset, so it is baked once per resize and blitted.
     */
    let substrate: HTMLCanvasElement | null = null;
    const buildSubstrate = () => {
      const off = document.createElement("canvas");
      const dprS = Math.min(window.devicePixelRatio || 1, 2);
      off.width = Math.max(1, Math.round(w * dprS));
      off.height = Math.max(1, Math.round(h * dprS));
      const octx = off.getContext("2d");
      if (!octx) return null;
      octx.setTransform(dprS, 0, 0, dprS, 0, 0);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2;
      const dim = ambient ? 0.85 : 1;
      const ctx = octx;
      // --- substrate background: layered gradient-shaded board ------------
      // Brighter, dimensional copper with a lit centre, raised mid-tones,
      // diagonal sheen, and a deep vignette so the neon traces read clearly
      // on the LOKMAT AMOLED square even under direct light.
      {
        const ambientLift = ambient ? 0.06 : 0;

        // 1) warm copper base — lighter in the middle, rich at the rim
        const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.45);
        base.addColorStop(0, `rgba(18,55,38,${0.72 + ambientLift})`);
        base.addColorStop(0.35, `rgba(10,38,24,${0.82 + ambientLift})`);
        base.addColorStop(0.75, `rgba(4,22,14,${0.92 + ambientLift})`);
        base.addColorStop(1, `rgba(1,10,6,${0.98 + ambientLift})`);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);

        // 2) inner glow — a soft emerald lantern behind the centre glyphs
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
        glow.addColorStop(0, `rgba(57,255,20,${0.14 * dim})`);
        glow.addColorStop(0.45, `rgba(34,211,255,${0.06 * dim})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // 3) diagonal sheen — two crossing light planes for 3D lift
        const sheen1 = ctx.createLinearGradient(0, 0, w, h);
        sheen1.addColorStop(0, `rgba(120,255,90,${0.055 * dim})`);
        sheen1.addColorStop(0.48, "rgba(57,255,20,0)");
        sheen1.addColorStop(0.52, "rgba(34,211,255,0)");
        sheen1.addColorStop(1, `rgba(90,230,255,${0.07 * dim})`);
        ctx.fillStyle = sheen1;
        ctx.fillRect(0, 0, w, h);

        const sheen2 = ctx.createLinearGradient(w, 0, 0, h);
        sheen2.addColorStop(0, `rgba(34,211,255,${0.04 * dim})`);
        sheen2.addColorStop(0.5, "rgba(0,0,0,0)");
        sheen2.addColorStop(1, `rgba(57,255,20,${0.05 * dim})`);
        ctx.fillStyle = sheen2;
        ctx.fillRect(0, 0, w, h);

        // 4) concentric depth rings — etched copper strata
        ctx.save();
        ctx.strokeStyle = `rgba(57,255,20,${0.045 * dim})`;
        ctx.lineWidth = 1;
        for (let i = 1; i <= 5; i++) {
          const rr = R * (0.22 + i * 0.14);
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, TAU);
          ctx.strokeStyle = `rgba(${i % 2 ? "57,255,20" : "34,211,255"},${0.04 * dim})`;
          ctx.stroke();
        }
        ctx.restore();

        // 5) vignette shadow — keeps the bezel feeling deep and recessed
        const vignette = ctx.createRadialGradient(cx, cy, R * 0.65, cx, cy, R * 1.55);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(0.65, `rgba(0,0,0,${0.18 * dim})`);
        vignette.addColorStop(1, `rgba(0,0,0,${0.5 * dim})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
      }
      return off;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvasLeft = rect.left;
      canvasTop = rect.top;
      // Old watch WebViews can report a 0-size box before layout settles;
      // fall back to the parent box, then the window, so the face still draws.
      const parent = canvas.parentElement;
      w = Math.max(1, rect.width || parent?.clientWidth || window.innerWidth);
      h = Math.max(1, rect.height || parent?.clientHeight || window.innerHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traces = buildTraces(w, h);
      const built = buildChips(w, h);
      chips = built.chips;
      buses = built.buses;
      substrate = buildSubstrate();
    };
    resize();
    // Re-measure shortly after mount: some watch WebViews lay out late.
    const settle = setTimeout(resize, 250);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const start = performance.now();
    const draw = (now: number) => {
      try {
        const t = (now - start) / 1000;
        const { strength, heading } = sigRef.current;
        const s = Math.min(1, Math.max(0, strength));
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) / 2;
        // Everything below was authored against a 400px face; scale it so the
        // glyphs stay proportional on a watch, a phone and a Chromebook alike.
        const k = Math.max(0.55, Math.min(1.1, Math.min(w, h) / 560));
        const dim = ambient ? 0.85 : 1;

        ctx.clearRect(0, 0, w, h);

        if (substrate) ctx.drawImage(substrate, 0, 0, w, h);

        // --- angle of attack ------------------------------------------------
        // The superposition gyro owns the attitude; the board and the compass
        // bend onto it. With no gyro mounted we fall back to the raw sensor so
        // the wallpaper still works completely on its own.
        const att = getAttitude();
        const anchorPt = getAnchor();
        const ax0 = anchorPt ? anchorPt.x - canvasLeft : cx;
        const ay0 = anchorPt ? anchorPt.y - canvasTop : cy;
        const gx = Math.max(-30, Math.min(30, tiltRef.current.gamma));
        const gy = Math.max(-30, Math.min(30, tiltRef.current.beta));
        // --- level lock -------------------------------------------------
        // Flat in the palm or flat on the wrist: the board stops leaning and
        // snaps square to the bezel, which is the cue that the compass plane is
        // true and an azimuth sweep can start.
        const offLevel = Math.max(Math.abs(tiltRef.current.beta), Math.abs(tiltRef.current.gamma));
        const target = sensorRef.current ? Math.max(0, Math.min(1, 1 - offLevel / 7)) : 0;
        lockRef.current += (target - lockRef.current) * 0.08;
        const lock = lockRef.current;
        // acquire edge: fire a one-shot flash the moment the plane goes true
        const isLocked = lock > 0.6;
        if (isLocked && !lockedRef.current) flashRef.current = 1;
        lockedRef.current = isLocked;
        flashRef.current *= 0.94;
        const flash = flashRef.current;
        const settle = 1 - lock; // 1 = free leaning, 0 = locked flat

        const pitch = Math.max(-0.7, Math.min(0.7, att.pitch - 0.4 || gy / 90)) * settle;
        const roll = Math.max(-0.7, Math.min(0.7, att.roll || gx / 90)) * settle;
        const F = Math.min(w, h) * 1.7;
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        /** Project a board-space point at height z through the tilted plane. */
        const warp = (x: number, y: number, z = 0): [number, number, number] => {
          const X = x - cx;
          const Y = y - cy;
          const rx = X * cr + z * sr;
          let rz = -X * sr + z * cr;
          const ry = Y * cp - rz * sp;
          rz = Y * sp + rz * cp;
          const d = F / Math.max(80, F - rz);
          return [cx + rx * d, cy + ry * d, d];
        };

        ctx.lineCap = "butt";

        for (let layer = 0; layer < 3; layer++) {
          const depth = 2 - layer; // 2 = deepest
          const scale = 1 - depth * 0.06;
          const fade = (1 - depth * 0.18) * dim;
          const zBase = -depth * 34; // physical separation between planes

          ctx.save();
          ctx.translate(cx + (gx / 30) * depth * 7 * settle, cy + (gy / 30) * depth * 7 * settle);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);

          // the dimensional hole each package rises out of and drops back into
          {
            const [hx, hy, hd] = warp(cx, cy, zBase - 40);
            const hr = Math.min(w, h) * 0.16 * hd;
            const ring = ctx.createRadialGradient(hx, hy, hr * 0.12, hx, hy, hr);
            ring.addColorStop(0, `rgba(0,0,0,${0.42 * fade})`);
            ring.addColorStop(0.55, `rgba(30,110,170,${0.22 * fade})`);
            ring.addColorStop(1, "rgba(0,0,0,0)");

            ctx.fillStyle = ring;
            ctx.beginPath();
            ctx.ellipse(hx, hy, hr, hr * (0.35 + 0.5 * Math.cos(pitch)), 0, 0, TAU);
            ctx.fill();
          }

          // chip packages: slide-lock on X and Y, float in Z, drop through
          const poses = chips.map((c) => chipPose(c, t));
          for (let ci = 0; ci < chips.length; ci++) {
            const chip = chips[ci]!;
            if (chip.layer !== layer) continue;
            const pose = poses[ci]!;
            if (pose.alpha <= 0.01) continue;
            const z = zBase + pose.z;
            const a = pose.alpha * fade;
            const lit = 0.5 + 0.5 * Math.sin(t * 1.7 + chip.phase);

            const q = [
              warp(pose.x, pose.y, z),
              warp(pose.x + chip.w, pose.y, z),
              warp(pose.x + chip.w, pose.y + chip.h, z),
              warp(pose.x, pose.y + chip.h, z),
            ];
            const face = (pts: [number, number, number][]) => {
              ctx.beginPath();
              ctx.moveTo(pts[0]![0], pts[0]![1]);
              for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
              ctx.closePath();
            };

            // extruded package body — the side walls give it real thickness
            const base = [
              warp(pose.x, pose.y, z - 10),
              warp(pose.x + chip.w, pose.y, z - 10),
              warp(pose.x + chip.w, pose.y + chip.h, z - 10),
              warp(pose.x, pose.y + chip.h, z - 10),
            ];
            for (let e = 0; e < 4; e++) {
              const n = (e + 1) % 4;
              face([q[e]!, q[n]!, base[n]!, base[e]!]);
              ctx.fillStyle = `rgba(6,18,34,${0.5 * a})`;
              ctx.fill();
              ctx.strokeStyle = `rgba(56,160,255,${0.16 * a})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }

            face(q);
            ctx.fillStyle = `rgba(8,22,40,${0.6 * a})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(56,160,255,${(0.3 + 0.24 * lit + 0.5 * pose.lock) * a})`;
            ctx.lineWidth = 1.4 + pose.lock * 1.6;
            ctx.stroke();

            // die outline
            const inx = chip.w * 0.2;
            const iny = chip.h * 0.22;
            face([
              warp(pose.x + inx, pose.y + iny, z),
              warp(pose.x + chip.w - inx, pose.y + iny, z),
              warp(pose.x + chip.w - inx, pose.y + chip.h - iny, z),
              warp(pose.x + inx, pose.y + chip.h - iny, z),
            ]);
            ctx.strokeStyle = `rgba(120,200,255,${0.2 * a})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();

            // pins on left/right edges
            for (let p = 0; p < chip.pins; p++) {
              const py = pose.y + ((p + 0.5) / chip.pins) * chip.h;
              const on = 0.5 + 0.5 * Math.sin(t * 4 + p + chip.phase);
              ctx.strokeStyle = `rgba(150,230,255,${(0.15 + 0.4 * on) * a})`;
              ctx.lineWidth = 1.8;
              for (const side of [-1, 1]) {
                const x0 = side < 0 ? pose.x : pose.x + chip.w;
                const [px1, py1] = warp(x0, py, z);
                const [px2, py2] = warp(x0 + side * 5, py, z - 4);
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.stroke();
              }
            }

            // seat flash the instant it locks into the slot
            if (pose.lock > 0.05) {
              const [lx, ly] = warp(pose.x + chip.w / 2, pose.y + chip.h / 2, z);
              ctx.strokeStyle = `rgba(57,255,20,${0.5 * pose.lock * a})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(lx, ly, chip.w * (0.6 + (1 - pose.lock) * 0.9), 0, TAU);
              ctx.stroke();
            }

            // triangulate the seated package onto the superposition gyro
            if (pose.lock > 0.02 || pose.z > -20) {
              const tri = 0.1 + 0.16 * lit;
              ctx.strokeStyle = `rgba(57,255,20,${tri * a})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(q[0]![0], q[0]![1]);
              ctx.lineTo(ax0, ay0);
              ctx.lineTo(q[2]![0], q[2]![1]);
              ctx.stroke();
            }
          }

          // bus bundles: parallel conductors with a clocked word travelling
          for (const bus of buses) {
            if (bus.layer !== layer) continue;
            const pa = poses[bus.ai]!;
            const pb = poses[bus.bi]!;
            const ca = chips[bus.ai]!;
            const cb = chips[bus.bi]!;
            const link = Math.min(pa.alpha, pb.alpha);
            if (link <= 0.02) continue;
            const az = zBase + pa.z;
            const bz = zBase + pb.z;
            const [ax, ay] = warp(pa.x + ca.w / 2, pa.y + ca.h / 2, az);
            const [bx, by] = warp(pb.x + cb.w / 2, pb.y + cb.h / 2, bz);
            const dx = bx - ax;
            const dy = by - ay;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            for (let lane = 0; lane < bus.lanes; lane++) {
              const off = (lane - (bus.lanes - 1) / 2) * 2.6;
              const x1 = ax + nx * off;
              const y1 = ay + ny * off;
              const x2 = bx + nx * off;
              const y2 = by + ny * off;
              ctx.strokeStyle = `rgba(56,160,255,${0.16 * fade * link})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();

              const f = ((t * (1 + s * 0.9)) / bus.period + bus.phase / TAU + lane * 0.07) % 1;
              const hx = x1 + (x2 - x1) * f;
              const hy = y1 + (y2 - y1) * f;
              const tf = Math.max(0, f - 0.12);
              const tx2 = x1 + (x2 - x1) * tf;
              const ty2 = y1 + (y2 - y1) * tf;
              const g = ctx.createLinearGradient(tx2, ty2, hx, hy);
              g.addColorStop(0, "rgba(56,160,255,0)");
              g.addColorStop(1, `rgba(170,235,255,${0.8 * fade * link})`);
              ctx.strokeStyle = g;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(tx2, ty2);
              ctx.lineTo(hx, hy);
              ctx.stroke();
            }
          }

          // etched runs: bold bus copper + hair-thin signal runs
          for (const tr of traces) {
            if (tr.layer !== layer) continue;
            const glow = 0.28 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.4 + tr.phase));
            ctx.lineWidth = tr.bold ? 3.2 : 1.1;
            ctx.strokeStyle = tr.bold
              ? `rgba(76,200,255,${(glow + 0.22) * fade})`
              : `rgba(160,235,255,${glow * 1.05 * fade})`;
            ctx.shadowColor = "rgba(34,211,255,0.35)";
            ctx.shadowBlur = tr.bold ? 6 : 3;

            ctx.beginPath();
            {
              const [p0x, p0y] = warp(tr.pts[0]![0], tr.pts[0]![1], zBase);
              ctx.moveTo(p0x, p0y);
              for (const [px, py] of tr.pts.slice(1)) {
                const [wx, wy] = warp(px, py, zBase);
                ctx.lineTo(wx, wy);
              }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // travelling pulse — clocked, faster as field strength rises
            const beatT = (t * (1 + s * 0.8)) / tr.period + tr.phase / TAU;
            const head = (beatT % 1) * tr.len;
            const tail = Math.max(0, head - (tr.bold ? 30 : 16));
            const [hx, hy] = warp(...alongTrace(tr, head), zBase);
            const [tx, ty] = warp(...alongTrace(tr, tail), zBase);
            const grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, "rgba(56,160,255,0)");
            grad.addColorStop(1, `rgba(220,255,255,${(tr.bold ? 1.0 : 0.85) * fade})`);

            ctx.strokeStyle = grad;
            ctx.lineWidth = tr.bold ? 3.6 : 1.6;
            ctx.shadowColor = "rgba(170,245,255,0.55)";
            ctx.shadowBlur = tr.bold ? 10 : 5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            ctx.shadowBlur = 0;
            if (tr.bold) {
              ctx.fillStyle = `rgba(230,255,255,${0.95 * fade})`;
              ctx.beginPath();
              ctx.arc(hx, hy, 2.2, 0, TAU);
              ctx.fill();
            }

            if (tr.pad) {
              const lit = 0.5 + 0.5 * Math.sin(t * 2 + tr.phase);
              ctx.fillStyle = `rgba(76,210,255,${(0.22 + 0.45 * lit) * fade})`;
              ctx.shadowColor = "rgba(57,255,20,0.45)";
              ctx.shadowBlur = 5;
              const sz = tr.bold ? 6 : 4.2;
              const [padx, pady] = warp(tr.x, tr.y, zBase);
              ctx.fillRect(padx - sz / 2, pady - sz / 2, sz, sz);
              ctx.shadowBlur = 0;
            }
          }

          ctx.restore();
        }

        // --- compass ticks marching the square edge -----------------------
        // The rose lives on the same tilted plane as the board, so it bends and
        // stretches with the gyro's angle of attack instead of staying flat.
        const inset = 3;
        const ww = w - inset * 2;
        const hh = h - inset * 2;
        const per = 2 * ww + 2 * hh;
        /** Point on the square edge, 0 = top-centre, increasing clockwise. */
        const flatEdge = (dist: number): [number, number] => {
          let d = (((dist + ww / 2) % per) + per) % per;
          if (d < ww) return [inset + d, inset];
          d -= ww;
          if (d < hh) return [w - inset, inset + d];
          d -= hh;
          if (d < ww) return [w - inset - d, h - inset];
          d -= ww;
          return [inset, h - inset - d];
        };
        /** Same point, bent onto the attitude plane (z rides just above copper). */
        const edgePoint = (dist: number): [number, number, number] => {
          const [x, y] = flatEdge(dist);
          return warp(x, y, 22);
        };
        const hdg = heading ?? 0;
        /** Where a real-world bearing sits on the edge right now. */
        const bearingDist = (deg: number) => (((deg - hdg) / 360) * per + per) % per;

        for (let i = 0; i < 72; i++) {
          const [x, y, d] = edgePoint((i / 72) * per - (hdg / 360) * per);
          const major = i % 9 === 0;
          ctx.fillStyle = major
            ? `rgba(57,255,20,${Math.min(1, 0.85 * d) * dim})`
            : `rgba(57,255,20,${Math.min(1, 0.3 * d) * dim})`;
          const size = (major ? 3 : 1.5) * d;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }

        // --- cardinal indices hovering on the edge ------------------------
        const cardinals: [string, number][] = [
          ["N", 0],
          ["E", 90],
          ["S", 180],
          ["W", 270],
        ];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const [label, deg] of cardinals) {
          const [fx, fy] = flatEdge(bearingDist(deg));
          // hover inward toward the centre, breathing with the pulse
          const beat = 0.5 + 0.5 * Math.sin(t * 2.2 + deg / 90);
          const nx = cx - fx;
          const ny = cy - fy;
          const nl = Math.hypot(nx, ny) || 1;
          const off = (56 + beat * 16) * k;
          const [lx, ly, d] = warp(fx + (nx / nl) * off, fy + (ny / nl) * off, 30 + beat * 10);
          const north = deg === 0;
          const a = Math.min(1, ((north ? 0.95 : 0.75) + 0.25 * beat) * d);
          // stretch the glyph along the plane: wider as it leans toward us
          ctx.save();
          ctx.translate(lx, ly);
          ctx.transform(1, Math.sin(roll) * 0.35, Math.sin(pitch) * -0.35, 1, 0, 0);
          ctx.scale(d, d * (0.75 + 0.35 * Math.cos(pitch)));
          ctx.font = `900 ${Math.round((north ? 44 : 34) * k)}px ui-monospace, monospace`;
          ctx.fillStyle = north ? `rgba(255,45,110,${a * dim})` : `rgba(57,255,20,${a * dim})`;
          ctx.fillText(label, 0, 0);
          // hexagonal bezel with an inscribed tetrahedron — flat facets track the
          // rounded-square corners better than a circle
          const rad = (36 + beat * 8) * k;
          const spin = Math.atan2(ny, nx);
          const hex: [number, number][] = [];
          for (let i = 0; i < 6; i++) {
            const ang = spin + i * (TAU / 6);
            hex.push([Math.cos(ang) * rad, Math.sin(ang) * rad * 0.92]);
          }
          ctx.beginPath();
          hex.forEach(([hx, hy], i) => (i ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy)));
          ctx.closePath();
          ctx.strokeStyle = north
            ? `rgba(255,45,110,${0.34 * dim})`
            : `rgba(57,255,20,${0.28 * dim})`;
          ctx.lineWidth = 4;
          ctx.stroke();
          // tetrahedron: base triangle + apex struts, leaning with the attitude
          const tri = [0, 2, 4].map((i) => hex[i]!);
          const apex: [number, number] = [
            Math.sin(roll) * rad * 0.35,
            -rad * 0.42 + Math.sin(pitch) * rad * 0.3,
          ];
          ctx.beginPath();
          tri.forEach(([hx, hy], i) => (i ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy)));
          ctx.closePath();
          for (const [hx, hy] of tri) {
            ctx.moveTo(hx, hy);
            ctx.lineTo(apex[0], apex[1]);
          }
          ctx.strokeStyle = north
            ? `rgba(255,45,110,${0.18 * dim})`
            : `rgba(57,255,20,${0.16 * dim})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.restore();
        }

        // --- azimuth lubber line + readout --------------------------------
        const [tx0, ty0] = edgePoint(0);
        const [lb1x, lb1y] = warp(w / 2, inset, 22);
        const [lb2x, lb2y] = warp(w / 2, inset + 28 * k, 22);
        ctx.beginPath();
        ctx.moveTo(lb1x, lb1y);
        ctx.lineTo(lb2x, lb2y);
        ctx.strokeStyle = `rgba(255,214,10,${0.95 * dim})`;
        ctx.lineWidth = Math.max(2, 5 * k);
        ctx.stroke();
        ctx.font = `900 ${Math.round(22 * k)}px ui-monospace, monospace`;
        ctx.fillStyle = `rgba(255,214,10,${(0.85 + 0.15 * Math.sin(t * 2)) * dim})`;
        ctx.fillText(`${hdg.toFixed(0).padStart(3, "0")}°`, cx, ty0 + 52 * k);

        // --- pulsing signal gauge -----------------------------------------
        const pulse = 0.5 + 0.5 * Math.sin(t * (1.6 + s * 2.4));
        for (let ring = 0; ring < 3; ring++) {
          const p = (t * (0.4 + s * 0.5) + ring / 3) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (0.24 + p * 0.66), 0, TAU);
          ctx.strokeStyle = `rgba(57,255,20,${(1 - p) * 0.48 * dim})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * s);
        ctx.strokeStyle = `rgba(57,255,20,${(0.72 + 0.28 * pulse) * dim})`;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.72, 0, TAU);
        ctx.strokeStyle = `rgba(57,255,20,${0.18 * dim})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // --- signal-ring octahedron + spinning dorito ---------------------
        const spin = t * 0.6;
        const tilt = 0.42 + tiltRef.current.beta / 400;
        const rad = R * 0.56;
        const project = (x: number, y: number, z: number): [number, number] => {
          const sx = x * Math.cos(spin) - z * Math.sin(spin);
          const sz = x * Math.sin(spin) + z * Math.cos(spin);
          const sy = y * Math.cos(tilt) - sz * Math.sin(tilt);
          const depth = 1 + (sz * Math.cos(tilt) + y * Math.sin(tilt)) * 0.35;
          return [cx + sx * rad * depth, cy + sy * rad * depth];
        };
        const verts: [number, number, number][] = [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ];
        const edges: [number, number][] = [
          [0, 2],
          [2, 1],
          [1, 3],
          [3, 0],
          [0, 4],
          [2, 4],
          [1, 4],
          [3, 4],
          [0, 5],
          [2, 5],
          [1, 5],
          [3, 5],
        ];
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "rgba(34,211,255,0.45)";
        ctx.shadowBlur = 8;
        for (const [a, b] of edges) {
          const [x1, y1] = project(...verts[a]!);
          const [x2, y2] = project(...verts[b]!);
          ctx.strokeStyle = `rgba(80,230,255,${(0.5 + 0.32 * pulse) * dim})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // dorito: counter-rotating amber triangle
        const dr = R * 0.728;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = -spin * 1.7 + (i / 3) * TAU - Math.PI / 2;
          const px = cx + Math.cos(a) * dr;
          const py = cy + Math.sin(a) * dr * (0.55 + 0.45 * Math.cos(tilt));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255,225,40,${(0.68 + 0.32 * pulse) * dim})`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "rgba(255,214,10,0.45)";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,214,10,${0.09 * dim})`;
        ctx.fill();

        // --- bezel level lock ---------------------------------------------
        // An outlined frame welds onto the bezel edge as the face comes level,
        // with a drop shadow underneath it for depth.
        if (lock > 0.02) {
          const m = Math.max(6, 10 * k);
          const rr = Math.max(10, 26 * k);
          const frame = (pad: number) => {
            const x0 = pad;
            const y0 = pad;
            const x1 = w - pad;
            const y1 = h - pad;
            ctx.beginPath();
            ctx.moveTo(x0 + rr, y0);
            ctx.lineTo(x1 - rr, y0);
            ctx.quadraticCurveTo(x1, y0, x1, y0 + rr);
            ctx.lineTo(x1, y1 - rr);
            ctx.quadraticCurveTo(x1, y1, x1 - rr, y1);
            ctx.lineTo(x0 + rr, y1);
            ctx.quadraticCurveTo(x0, y1, x0, y1 - rr);
            ctx.lineTo(x0, y0 + rr);
            ctx.quadraticCurveTo(x0, y0, x0, y0 + rr);
            ctx.closePath();
          };
          ctx.save();
          // shadow pass: an offset dark outline reads as real depth
          ctx.shadowColor = `rgba(0,0,0,${0.8 * lock})`;
          ctx.shadowBlur = 12 * k;
          ctx.shadowOffsetY = 3 * k;
          frame(m + 2 * k);
          ctx.strokeStyle = `rgba(0,0,0,${0.6 * lock})`;
          ctx.lineWidth = 4 * k;
          ctx.stroke();
          ctx.restore();

          frame(m);
          ctx.strokeStyle = `rgba(57,255,20,${(0.35 + 0.45 * lock) * dim})`;
          ctx.lineWidth = Math.max(1.5, 2.4 * k);
          ctx.stroke();

          // corner brackets: the hard "seated" indicators
          const bl = 26 * k;
          ctx.strokeStyle = `rgba(255,214,10,${0.85 * lock * dim})`;
          ctx.lineWidth = Math.max(2, 3 * k);
          const corners: [number, number, number, number][] = [
            [m, m, 1, 1],
            [w - m, m, -1, 1],
            [w - m, h - m, -1, -1],
            [m, h - m, 1, -1],
          ];
          for (const [x, y, sx, sy] of corners) {
            ctx.beginPath();
            ctx.moveTo(x + sx * bl, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + sy * bl);
            ctx.stroke();
          }

          // status: the sweep gate
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `900 ${Math.round(13 * k)}px ui-monospace, monospace`;
          ctx.fillStyle = `rgba(57,255,20,${lock * dim})`;
          ctx.fillText(
            lock > 0.6 ? "LEVEL LOCK · SWEEP READY" : `LEVELLING ${offLevel.toFixed(1)}°`,
            cx,
            m + 34 * k,
          );
        }

        // --- sextant protractor --------------------------------------------
        if (sextant) {
          // Mount detection: worn on the *edge* of the wrist the screen faces
          // sideways, so the sighting axis is the roll axis (gamma) rather than
          // the pitch axis (beta). Pick whichever axis is actually doing the
          // sighting so the arc reads the same either way you wear it.
          const beta = tiltRef.current.beta;
          const gamma = tiltRef.current.gamma;
          const edgeMount = Math.abs(gamma) > 45;
          const raw = edgeMount ? Math.abs(gamma) : 90 - Math.abs(beta);
          const alt = Math.max(
            0,
            Math.min(90, edgeMount ? 90 - Math.abs(90 - Math.abs(gamma)) : raw),
          );
          // Keep the vertex clear of the bottom readout strip: in landscape the
          // arc used to run underneath the stat divs and the first 45° of the
          // sweep was invisible.
          const vx = cx;
          const vy = h - Math.max(52 * k, h * 0.24);
          const arcR = Math.max(40, Math.min(w * 0.46, vy - 12 * k));

          ctx.save();
          ctx.lineCap = "butt";
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 8 * k;
          // graduated arc 0..90
          ctx.beginPath();
          ctx.arc(vx, vy, arcR, Math.PI, Math.PI * 1.5);
          ctx.strokeStyle = `rgba(34,211,255,${0.7 * dim})`;
          ctx.lineWidth = Math.max(1.5, 2 * k);
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (let d = 0; d <= 90; d += 5) {
            const a = Math.PI + (d / 90) * (Math.PI / 2);
            const major = d % 15 === 0;
            const r0 = arcR - (major ? 14 : 7) * k;
            ctx.beginPath();
            ctx.moveTo(vx + Math.cos(a) * r0, vy + Math.sin(a) * r0);
            ctx.lineTo(vx + Math.cos(a) * arcR, vy + Math.sin(a) * arcR);
            ctx.strokeStyle = `rgba(34,211,255,${(major ? 0.85 : 0.4) * dim})`;
            ctx.lineWidth = major ? 2 : 1;
            ctx.stroke();
            if (major) {
              ctx.font = `700 ${Math.round(10 * k)}px ui-monospace, monospace`;
              ctx.fillStyle = `rgba(34,211,255,${0.75 * dim})`;
              ctx.fillText(
                String(d),
                vx + Math.cos(a) * (arcR - 26 * k),
                vy + Math.sin(a) * (arcR - 26 * k),
              );
            }
          }
          // index arm at the measured altitude
          const aa = Math.PI + (alt / 90) * (Math.PI / 2);
          const ax = vx + Math.cos(aa) * arcR;
          const ay = vy + Math.sin(aa) * arcR;
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(ax, ay);
          ctx.strokeStyle = `rgba(255,214,10,${0.95 * dim})`;
          ctx.lineWidth = Math.max(2, 2.6 * k);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(vx, vy, 4 * k, 0, TAU);
          ctx.fillStyle = `rgba(255,214,10,${0.9 * dim})`;
          ctx.fill();

          // --- big face indicator -------------------------------------------
          // Arm raised toward the star: the whole face becomes the angle, so it
          // stays readable at arm's length on a 400px watch.
          {
            const big = Math.round(Math.min(w, h) * 0.3);
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 14 * k;
            ctx.font = `900 ${big}px ui-monospace, monospace`;
            ctx.fillStyle = `rgba(255,214,10,${(alt > 3 ? 0.96 : 0.5) * dim})`;
            ctx.fillText(`${alt.toFixed(1)}°`, cx, cy - 6 * k);
            ctx.font = `700 ${Math.round(11 * k)}px ui-monospace, monospace`;
            ctx.fillStyle = `rgba(34,211,255,${0.9 * dim})`;
            ctx.fillText(
              edgeMount ? "EDGE MOUNT · SIGHT ALTITUDE" : "TOP MOUNT · SIGHT ALTITUDE",
              cx,
              cy + big * 0.42,
            );

            // azimuth: where the sighting line points, so a fix gives you north
            const az = (((heading ?? tiltRef.current.alpha ?? 0) % 360) + 360) % 360;
            const card = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8];
            ctx.font = `900 ${Math.round(20 * k)}px ui-monospace, monospace`;
            ctx.fillStyle = `rgba(57,255,20,${0.95 * dim})`;
            ctx.fillText(`AZ ${az.toFixed(0)}° ${card}`, cx, cy + big * 0.42 + 22 * k);
            ctx.font = `700 ${Math.round(9 * k)}px ui-monospace, monospace`;
            ctx.fillStyle = `rgba(57,255,20,${0.7 * dim})`;
            ctx.fillText(
              heading !== null ? "MAGNETIC BEARING" : "NO MAG · USING GYRO YAW",
              cx,
              cy + big * 0.42 + 36 * k,
            );
            ctx.restore();
          }

          // floating self-levelling readout: stacked on the right-hand side so
          // the central compass needle and sextant arc stay unobstructed.
          const bw = 74 * k;
          const bh = 26 * k;
          const rx = w - 12 * k - bw / 2;
          const ry = h / 2;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(-(edgeMount ? 0 : roll) * 0.8);
          ctx.fillStyle = "rgba(2,8,14,0.82)";
          ctx.strokeStyle = `rgba(255,214,10,${0.8 * dim})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.rect(-bw / 2, -bh / 2, bw, bh);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgba(255,214,10,${dim})`;
          ctx.font = `900 ${Math.round(14 * k)}px ui-monospace, monospace`;
          ctx.fillText(`${alt.toFixed(1)}°`, 0, -1);
          ctx.font = `700 ${Math.round(7 * k)}px ui-monospace, monospace`;
          ctx.fillStyle = `rgba(34,211,255,${0.9 * dim})`;
          ctx.fillText(alt > 88 ? "VERTEX 90" : "ALTITUDE", 0, bh / 2 - 5 * k);
          ctx.restore();
          ctx.restore();
        }

        // --- superposition lobes ------------------------------------------
        for (let i = 0; i < 2; i++) {
          const phase = t * 1.1 + i * Math.PI;
          const amp = R * 0.16 * (0.6 + 0.4 * Math.sin(phase));
          ctx.beginPath();
          ctx.ellipse(cx, cy, amp * 2.1, amp, spin * (i ? -1 : 1), 0, TAU);
          ctx.strokeStyle = `rgba(255,45,110,${0.25 * dim})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } catch (err) {
        // A WebView that cannot execute part of the 2D pipeline would
        // otherwise freeze on a black frame; swap to the SVG face instead.
        markCanvasBroken();
        setFallback(true);
        reportRender(
          { pathway: "svg", attempt },
          `draw error · ${String((err as Error)?.message ?? err).slice(0, 60)}`,
        );
        return;
      }

      if (!paintedRef.current) {
        paintedRef.current = true;
        setPainted(true);
        const ms = Math.round(performance.now() - mountedAt.current);
        reportRender(
          { pathway: "canvas", attempt, firstFrameMs: ms },
          `canvas frame in ${ms}ms · parity with phone build`,
        );
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // Some watch WebViews never service requestAnimationFrame for an
    // offscreen-composited canvas: if nothing painted in time, stay on SVG.
    const watchdog = setTimeout(() => {
      if (!paintedRef.current) {
        setFallback(true);
        reportRender(
          { pathway: "svg", attempt },
          `no frame in ${tuning.watchdogMs}ms · svg pathway`,
        );
      }
    }, tuning.watchdogMs);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(watchdog);
      clearTimeout(settle);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [ambient, sextant, fallback, safe, attempt, tuning.watchdogMs]);

  // The SVG face is always the base layer: it renders on the server, needs no
  // JS, no rAF and no canvas, so the watch always has a visible background on
  // load. The canvas is layered on top and only becomes visible once a frame
  // has actually been painted.
  return (
    <div className={className ?? "absolute inset-0 h-full w-full"}>
      <FaceFallbackSVG
        strength={signal.strength}
        heading={signal.heading}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {!fallback && !safe ? (
        <canvas
          key={attempt}
          ref={ref}

          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500"
          style={{ opacity: painted ? 1 : 0 }}
        />
      ) : null}
      <RenderDiagnostics />
    </div>
  );
}
