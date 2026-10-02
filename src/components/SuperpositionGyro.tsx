import { useEffect, useRef, useState } from "react";
import { clearAttitude, publishAttitude } from "@/lib/gyro-bus";
import { canvas2dWorks, markCanvasBroken } from "@/lib/canvas-support";

/**
 * Superposition gyro — an interactive 3D gimbal widget.
 *
 * Behaviours modelled on the S10 gyro widget:
 *  - device tilt drives a parallax offset and a lazy "settle" rotation
 *  - drag/swipe on the widget spins it directly, with inertia + friction
 *  - released spin decays back toward the sensor-aligned rest attitude
 *  - superposed ghost copies trail the live attitude (probability cloud)
 */

type Props = {
  /** 0..1 field strength — brightens the core and speeds the shimmer. */
  strength?: number;
  className?: string;
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

type Vec3 = [number, number, number];

function rotate(v: Vec3, yaw: number, pitch: number, roll: number): Vec3 {
  let [x, y, z] = v;
  // roll (z)
  let c = Math.cos(roll);
  let s = Math.sin(roll);
  [x, y] = [x * c - y * s, x * s + y * c];
  // pitch (x)
  c = Math.cos(pitch);
  s = Math.sin(pitch);
  [y, z] = [y * c - z * s, y * s + z * c];
  // yaw (y)
  c = Math.cos(yaw);
  s = Math.sin(yaw);
  [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}

/** Level state for the SVG path (watch WebViews never run the canvas). */
function useLevel() {
  const [level, setLevel] = useState(false);
  useEffect(() => {
    const onTilt = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const flat = Math.max(Math.abs(beta), Math.abs(gamma));
      const edge = Math.max(Math.abs(beta), Math.abs(90 - Math.abs(gamma)));
      setLevel(Math.min(flat, edge) < 7);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, []);
  return level;
}

export default function SuperpositionGyro({ strength = 0.5, className }: Props) {
  const level = useLevel();

  const ref = useRef<HTMLCanvasElement | null>(null);
  const strengthRef = useRef(strength);
  strengthRef.current = strength;

  // Start with the SVG gimbal so a watch never receives an unprobed canvas
  // during SSR/hydration. Modern phone/tablet browsers opt into canvas after
  // the capability check completes.
  const [fallback, setFallback] = useState(true);
  useEffect(() => {
    setFallback(!canvas2dWorks());
  }, []);

  useEffect(() => {
    if (fallback) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    /**
     * Adaptive quality. Handsets stutter because we ask a mid-range GPU to
     * fill a 2x-DPR canvas with blurred, gradient-heavy strokes every frame.
     * quality 2 = full, 1 = fewer ghosts + no shadow blur, 0 = 1x DPR skeleton.
     */
    let quality = 2;
    const dprFor = (q: number) => (q >= 2 ? 2 : q === 1 ? 1.5 : 1);
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprFor(quality));
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // --- attitude state ------------------------------------------------
    const att = { yaw: 0, pitch: 0.4, roll: 0 };
    const vel = { yaw: 0.018, pitch: 0, roll: 0 };
    const sensor = { yaw: 0, pitch: 0.4, roll: 0 };
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let grabbed = 0; // 0..1 highlight on touch
    // --- level lock ------------------------------------------------------
    // Bring the device level (flat, or square on its edge) and the gimbal
    // stops drifting, snaps square to the bezel and flashes once.
    let lock = 0; // smoothed 0..1
    let locked = false;
    let flash = 0; // one-shot, decays
    let hasSensor = false;
    let offLevel = 90;

    const onTilt = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const alpha = e.alpha ?? 0;
      hasSensor = e.beta !== null || e.gamma !== null;
      // Level either flat on the palm (beta/gamma ~ 0) or held on edge in
      // landscape (|gamma| ~ 90) — whichever is closer counts as true.
      const flat = Math.max(Math.abs(beta), Math.abs(gamma));
      const edge = Math.max(Math.abs(beta), Math.abs(90 - Math.abs(gamma)));
      offLevel = Math.min(flat, edge);
      sensor.pitch = 0.4 + Math.max(-60, Math.min(60, beta)) * DEG * 0.5;
      sensor.roll = Math.max(-60, Math.min(60, gamma)) * DEG * 0.5;
      sensor.yaw = alpha * DEG;
      parallax.tx = Math.max(-1, Math.min(1, gamma / 45));
      parallax.ty = Math.max(-1, Math.min(1, (beta - 30) / 45));
    };
    window.addEventListener("deviceorientation", onTilt);

    // --- direct screen input -------------------------------------------
    const pos = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
    const down = (e: PointerEvent) => {
      dragging = true;
      grabbed = 1;
      const p = pos(e);
      lastX = p.x;
      lastY = p.y;
      lastT = performance.now();
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const p = pos(e);
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      const dx = p.x - lastX;
      const dy = p.y - lastY;
      att.yaw += dx * 0.012;
      att.pitch += dy * 0.012;
      vel.yaw = (dx * 0.012 * 16) / dt;
      vel.pitch = (dy * 0.012 * 16) / dt;
      vel.roll = (dx * 0.002 * 16) / dt;
      lastX = p.x;
      lastY = p.y;
      lastT = now;
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    // --- geometry --------------------------------------------------------
    const ringPts = (axis: 0 | 1 | 2, n = 64): Vec3[] => {
      const out: Vec3[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        out.push(axis === 0 ? [0, c, s] : axis === 1 ? [c, 0, s] : [c, s, 0]);
      }
      return out;
    };
    const rings: { pts: Vec3[]; scale: number; color: string }[] = [
      { pts: ringPts(1), scale: 1, color: "57,255,20" },
      { pts: ringPts(0), scale: 0.78, color: "34,211,255" },
      { pts: ringPts(2), scale: 0.56, color: "255,45,110" },
    ];

    // superposed ghost attitudes trailing the live one
    const ghosts: { yaw: number; pitch: number; roll: number }[] = Array.from(
      { length: 3 },
      () => ({ ...att }),
    );

    let raf = 0;
    const start = performance.now();
    let lastFrame = start;
    // Cached widget centre — reading layout every frame is what makes the
    // spin stutter on low fill-rate devices.
    let center = { x: 0, y: 0 };
    const measure = () => {
      const r = canvas.getBoundingClientRect();
      center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    measure();
    const measureTimer = window.setInterval(measure, 1000);
    // Rolling frame cost drives the quality ladder below.
    let avgFrame = 16;
    let steadyFast = 0;
    const draw = (now: number) => {
      try {
        // A backgrounded tab that keeps compositing is wasted battery + jank
        // on resume; idle out until it is visible again.
        if (typeof document !== "undefined" && document.hidden) {
          lastFrame = now;
          raf = requestAnimationFrame(draw);
          return;
        }
        const t = (now - start) / 1000;
        // Normalise every integration step to a 60fps tick so a 20fps watch
        // spins at exactly the same rate as a 60fps phone instead of crawling.
        const dt = now - lastFrame;
        const k = Math.min(4, Math.max(0.25, dt / (1000 / 60)));
        lastFrame = now;
        if (dt > 0 && dt < 500) avgFrame += (dt - avgFrame) * 0.1;
        if (avgFrame > 26 && quality > 0) {
          // Sustained sub-40fps: shed work rather than stutter.
          quality -= 1;
          avgFrame = 16;
          steadyFast = 0;
          resize();
        } else if (avgFrame < 18 && quality < 2) {
          steadyFast += 1;
          if (steadyFast > 180) {
            quality += 1;
            steadyFast = 0;
            avgFrame = 16;
            resize();
          }
        }

        const ease = (rate: number) => 1 - Math.pow(1 - rate, k);
        const s = Math.min(1, Math.max(0, strengthRef.current));
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) * 0.504;

        // level lock: 1 when the device is true, 0 when it is off-angle
        const lockTarget = hasSensor && !dragging ? Math.max(0, Math.min(1, 1 - offLevel / 7)) : 0;
        lock += (lockTarget - lock) * ease(0.08);
        const nowLocked = lock > 0.6;
        if (nowLocked && !locked) flash = 1;
        locked = nowLocked;
        flash *= Math.pow(0.94, k);

        if (!dragging) {
          // inertia + friction, then ease back onto the sensor attitude
          att.yaw += vel.yaw * (1 - lock) * k;
          att.pitch += vel.pitch * (1 - lock) * k;
          att.roll += vel.roll * (1 - lock) * k;
          vel.yaw *= Math.pow(0.965, k);
          vel.pitch *= Math.pow(0.94, k);
          vel.roll *= Math.pow(0.94, k);
          att.pitch += (sensor.pitch - att.pitch) * ease(0.03);
          att.roll += (sensor.roll - att.roll) * ease(0.03);
          if (Math.abs(vel.yaw) < 0.009) vel.yaw += (0.018 - vel.yaw) * ease(0.05) * (1 - lock);
          if (lock > 0.02) {
            // snap square to the bezel: pitch/roll to zero, yaw to the nearest
            // quarter turn, so the gimbal welds into place as it comes level.
            const snapYaw = Math.round(att.yaw / (Math.PI / 2)) * (Math.PI / 2);
            const g = ease(0.12 * lock);
            att.pitch += (0 - att.pitch) * g;
            att.roll += (0 - att.roll) * g;
            att.yaw += (snapYaw - att.yaw) * g;
          }
        }
        grabbed += ((dragging ? 1 : 0) - grabbed) * ease(0.15);
        parallax.x += (parallax.tx - parallax.x) * ease(0.08) * (1 - lock);
        parallax.y += (parallax.ty - parallax.y) * ease(0.08) * (1 - lock);

        for (let i = ghosts.length - 1; i >= 0; i--) {
          const src = i === 0 ? att : ghosts[i - 1]!;
          const g = ghosts[i]!;
          g.yaw += (src.yaw - g.yaw) * ease(0.18);
          g.pitch += (src.pitch - g.pitch) * ease(0.18);
          g.roll += (src.roll - g.roll) * ease(0.18);
        }

        ctx.clearRect(0, 0, w, h);

        // broadcast the live attitude + our screen anchor: the face wallpaper
        // bends its substrate and compass onto this same angle of attack
        publishAttitude(att, center);

        const px = parallax.x * R * 0.12;
        const py = parallax.y * R * 0.12;

        const project = (
          v: Vec3,
          a: { yaw: number; pitch: number; roll: number },
          scale: number,
        ) => {
          const [x, y, z] = rotate(v, a.yaw, a.pitch, a.roll);
          const d = 1 / (1.9 - z * 0.55);
          return {
            x: cx + px + x * R * scale * d * 1.9,
            y: cy + py + y * R * scale * d * 1.9,
            z,
          };
        };

        const strokeRing = (
          pts: Vec3[],
          a: { yaw: number; pitch: number; roll: number },
          scale: number,
          color: string,
          alpha: number,
          width: number,
        ) => {
          for (let i = 0; i < pts.length; i++) {
            const p1 = project(pts[i]!, a, scale);
            const p2 = project(pts[(i + 1) % pts.length]!, a, scale);
            const depth = 0.35 + 0.65 * ((p1.z + 1) / 2);
            ctx.strokeStyle = `rgba(${color},${alpha * depth})`;
            ctx.lineWidth = width * (0.6 + 0.6 * depth);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        };

        // superposition cloud: ghost attitudes first, faint.
        // Ghost passes are the single most expensive thing here — thin them out
        // before the frame budget blows instead of dropping frames.
        const ghostCount = quality >= 2 ? ghosts.length : quality === 1 ? 1 : 0;
        for (let gi = 0; gi < ghostCount; gi++) {
          const g = ghosts[gi]!;
          const fade = 0.1 * (1 - gi / ghosts.length);
          rings.forEach((r) => strokeRing(r.pts, g, r.scale, r.color, fade, 1));
        }

        // live gimbal — brightens hard as it welds into the level position
        const boost = Math.min(1, 0.55 + 0.35 * s + 0.25 * grabbed + 0.5 * lock + 0.8 * flash);
        ctx.save();
        // shadowBlur is the priciest raster op on mobile GPUs; full quality only.
        if (quality >= 2 && (lock > 0.02 || flash > 0.02)) {
          ctx.shadowColor = `rgba(57,255,20,${0.5 * lock + 0.5 * flash})`;
          ctx.shadowBlur = (8 + 22 * flash) * (0.4 + lock);
        }

        rings.forEach((r, i) => {
          strokeRing(r.pts, att, r.scale, r.color, boost * (1 - i * 0.12), 1.4 + 1.6 * flash);
        });
        ctx.restore();

        // axis spindle
        const axes: [Vec3, string][] = [
          [[0, 0, 1], "57,255,20"],
          [[1, 0, 0], "34,211,255"],
          [[0, 1, 0], "255,214,10"],
        ];
        for (const [v, color] of axes) {
          const a1 = project([-v[0], -v[1], -v[2]], att, 1.05);
          const a2 = project(v, att, 1.05);
          ctx.strokeStyle = `rgba(${color},${0.35 + 0.3 * grabbed})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a1.x, a1.y);
          ctx.lineTo(a2.x, a2.y);
          ctx.stroke();
          ctx.fillStyle = `rgba(${color},${0.8})`;
          ctx.beginPath();
          ctx.arc(a2.x, a2.y, 1.8 + 0.8 * ((a2.z + 1) / 2), 0, TAU);
          ctx.fill();
        }

        // probability core — flat fill on the stripped tier, gradient otherwise
        const beat = 0.5 + 0.5 * Math.sin(t * (2 + s * 3));
        if (quality > 0) {
          const core = ctx.createRadialGradient(cx + px, cy + py, 0, cx + px, cy + py, R * 0.5);
          core.addColorStop(0, `rgba(57,255,20,${0.28 + 0.22 * beat})`);
          core.addColorStop(1, "rgba(57,255,20,0)");
          ctx.fillStyle = core;
        } else {
          ctx.fillStyle = `rgba(57,255,20,${0.12 + 0.08 * beat})`;
        }
        ctx.beginPath();
        ctx.arc(cx + px, cy + py, R * 0.5, 0, TAU);
        ctx.fill();

        // --- lock cage + acquire flash --------------------------------------
        if (lock > 0.02) {
          const m = R * 0.92;
          ctx.save();
          ctx.strokeStyle = `rgba(57,255,20,${0.25 + 0.55 * lock})`;
          ctx.lineWidth = 1.4;
          const bl = m * 0.32;
          const corners: [number, number, number, number][] = [
            [cx - m, cy - m, 1, 1],
            [cx + m, cy - m, -1, 1],
            [cx + m, cy + m, -1, -1],
            [cx - m, cy + m, 1, -1],
          ];
          for (const [x, y, sx, sy] of corners) {
            ctx.beginPath();
            ctx.moveTo(x + sx * bl, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + sy * bl);
            ctx.stroke();
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `900 ${Math.max(8, Math.round(R * 0.12))}px ui-monospace, monospace`;
          ctx.fillStyle = `rgba(255,214,10,${lock})`;
          ctx.fillText("LOCK", cx, cy + m * 0.78);
          ctx.restore();
        }
        if (flash > 0.02) {
          // shockwave: the graphic pops the instant the gimbal comes true
          const wave = 1 - flash;
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${flash * 0.8})`;
          ctx.lineWidth = 2 + 4 * flash;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (0.3 + wave * 0.95), 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = `rgba(57,255,20,${flash * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (0.2 + wave * 1.25), 0, TAU);
          ctx.stroke();
          const pop = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
          pop.addColorStop(0, `rgba(255,255,255,${flash * 0.35})`);
          pop.addColorStop(1, "rgba(57,255,20,0)");
          ctx.fillStyle = pop;
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      } catch {
        markCanvasBroken();
        setFallback(true);
        return;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(measureTimer);
      clearAttitude();

      ro.disconnect();
      window.removeEventListener("deviceorientation", onTilt);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [fallback]);

  // Dead-canvas WebViews (AOSP watch builds) still render SVG, so the gyro
  // keeps its wireframe and spin through CSS instead of going black.
  if (fallback)
    return (
      <div
        className={`relative ${className ?? "h-full w-full"}`}
        role="img"
        aria-label="Superposition gyro"
      >
        {/* Stable SVG path: never promote this layer or animate transforms.
            The LOKMAT compositor can paint those effects once and then drop
            the entire page; opacity-only pulses below match the proven map
            rendering profile. */}
        <div className="absolute inset-0">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <g fill="none" stroke="#00ff3b" strokeWidth="1.2">
              <circle cx="50" cy="50" r="34" strokeOpacity={level ? 0.8 : 0.35} />
              <ellipse cx="50" cy="50" rx="34" ry={level ? 34 : 12} strokeOpacity="0.6" />
              <ellipse cx="50" cy="50" rx={level ? 22 : 12} ry="34" strokeOpacity="0.45" />
              <path d="M50 16 L74 50 L50 84 L26 50 Z" stroke="#00eeff" strokeOpacity="0.85" />
              <path d="M50 16 L50 84 M26 50 L74 50" strokeOpacity="0.3" />
            </g>
          </svg>
        </div>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {level ? (
            <g key="lock" fill="none">
              <circle
                cx="50"
                cy="50"
                r="30"
                stroke="#ffffff"
                strokeWidth="2"
                className="gyro-flash"
              />
              <g stroke="#ffd60a" strokeWidth="1.4">
                <path d="M12 24 L12 12 L24 12" />
                <path d="M88 24 L88 12 L76 12" />
                <path d="M88 76 L88 88 L76 88" />
                <path d="M12 76 L12 88 L24 88" />
              </g>
              <text x="50" y="95" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffd60a">
                LOCK
              </text>
            </g>
          ) : null}
          <circle cx="50" cy="50" r="5" fill="#00ff3b" fillOpacity="0.8" className="reel-pulse" />
        </svg>
      </div>
    );

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Superposition gyro — drag to spin, tilt to parallax"
      className={className ?? "h-full w-full touch-none"}
      style={{ touchAction: "none" }}
    />
  );
}
