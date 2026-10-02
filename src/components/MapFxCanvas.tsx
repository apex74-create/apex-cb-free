import { useEffect, useRef } from "react";
import {
  createLane,
  DEFAULT_EXPLODE,
  stepExplode,
  stepIrRoom,
  WATCH_EXPLODE,
  type Contact,
  type ExplodeConfig,
} from "@/lib/engines/explode-seek";
import { detectProfile, throttledLoop } from "@/lib/map-throttle";
import { canvas2dWorks } from "@/lib/canvas-support";

export type FxPoint = { lat: number; lon: number; type: Contact["type"]; label?: string };

/**
 * Effects layer for the map — the shield's explode-seek chain reaction and IR
 * room rings, drawn into a canvas pinned over the Leaflet container.
 *
 * Renders nothing on watch/legacy builds (where the canvas compositor is the
 * known crash source); the map falls back to its static vector chrome there.
 */
export default function MapFxCanvas({
  map,
  origin,
  points,
  explode,
  ir,
  opacity,
}: {
  map: import("leaflet").Map | null;
  origin: { lat: number; lon: number } | null;
  points: FxPoint[];
  explode: boolean;
  ir: boolean;
  opacity: number;
}) {
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const originRef = useRef(origin);
  originRef.current = origin;
  const flagsRef = useRef({ explode, ir, opacity });
  flagsRef.current = { explode, ir, opacity };

  useEffect(() => {
    if (!map) return;
    const profile = detectProfile();
    if (profile.vectorOnly || !canvas2dWorks()) return;

    const container = map.getContainer();
    const cv = document.createElement("canvas");
    cv.className = "apex-map-fx";
    cv.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:420;";
    container.appendChild(cv);

    const resize = () => {
      const r = container.getBoundingClientRect();
      cv.width = Math.max(1, r.width | 0);
      cv.height = Math.max(1, r.height | 0);
    };
    resize();
    map.on("resize move zoom", resize);

    const ctx = cv.getContext("2d");
    if (!ctx) {
      cv.remove();
      return;
    }

    const lane = createLane();
    const cfg: ExplodeConfig = {
      ...DEFAULT_EXPLODE,
      ...(profile.name === "phone" ? {} : WATCH_EXPLODE),
    };
    let phase = 0;

    const stop = throttledLoop(profile.fps, (now, dtScale) => {
      const { explode: fxExplode, ir: fxIr, opacity: fxOpacity } = flagsRef.current;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!fxExplode && !fxIr) return;

      const o = originRef.current;
      let origPx = { x: cv.width / 2, y: cv.height / 2 };
      if (o) {
        try {
          const pt = map.latLngToContainerPoint([o.lat, o.lon]);
          origPx = { x: pt.x, y: pt.y };
        } catch {
          /* map torn down mid-frame */
        }
      }

      if (fxIr) {
        phase += 0.02 * dtScale;
        stepIrRoom(ctx, origPx, phase, fxOpacity);
      }

      if (fxExplode) {
        const contacts: Contact[] = [];
        for (const p of pointsRef.current) {
          try {
            const pt = map.latLngToContainerPoint([p.lat, p.lon]);
            if (pt.x < -40 || pt.y < -40 || pt.x > cv.width + 40 || pt.y > cv.height + 40) continue;
            contacts.push(
              p.label
                ? { x: pt.x, y: pt.y, type: p.type, label: p.label }
                : { x: pt.x, y: pt.y, type: p.type },
            );
          } catch {
            /* skip unprojectable point */
          }
        }
        cfg.opacity = fxOpacity;
        stepExplode(ctx, lane, cfg, origPx, contacts, now, dtScale);
      }
    });

    return () => {
      stop();
      map.off("resize move zoom", resize);
      cv.remove();
    };
  }, [map]);

  return null;
}
