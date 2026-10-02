/**
 * Community shell stub — the shield's explode-seek chain reaction and IR-room
 * rings, simplified for the community shell. The full parameter set ships in
 * the licensed native build.
 */

export type ContactType =
  | "trusted"
  | "home"
  | "gateway"
  | "unknown"
  | "ble"
  | "iot"
  | "ap"
  | "evil_twin";

export const CONTACT_COLORS: Record<ContactType, string> = {
  trusted: "#00ff88",
  home: "#00aa55",
  gateway: "#ff9900",
  unknown: "#ff3366",
  ble: "#00ccff",
  iot: "#cc88ff",
  ap: "#ffcc00",
  evil_twin: "#ff0000",
};

export type Contact = { x: number; y: number; type: ContactType; label?: string; flash?: number };

export type ExplodeConfig = {
  /** ms between origin bursts */
  period: number;
  ringsPerBurst: number;
  maxGen: number;
  ringSpeed: number;
  /** px tolerance for a wavefront "catching" a contact */
  catchRadius: number;
  maxPulses: number;
  opacity: number;
};

export const DEFAULT_EXPLODE: ExplodeConfig = {
  period: 4000,
  ringsPerBurst: 2,
  maxGen: 2,
  ringSpeed: 40,
  catchRadius: 14,
  maxPulses: 6,
  opacity: 1,
};

export const WATCH_EXPLODE: Partial<ExplodeConfig> = {
  ringsPerBurst: 1,
  maxGen: 1,
  maxPulses: 3,
};

export type Lane = { rings: Array<{ r: number; born: number; gen: number }> };

export function createLane(): Lane {
  return { rings: [] };
}

/** Advance and draw the chain-reaction rings around the origin. */
export function stepExplode(
  ctx: CanvasRenderingContext2D,
  lane: Lane,
  cfg: ExplodeConfig,
  origin: { x: number; y: number },
  contacts: Contact[],
  now: number,
  dtScale = 1,
): void {
  if (lane.rings.length === 0 || now - lane.rings[lane.rings.length - 1]!.born > cfg.period) {
    lane.rings.push({ r: 0, born: now, gen: 0 });
  }
  lane.rings = lane.rings.filter(
    (ring) => ring.r < Math.max(contacts.length ? 400 : 220) * (ring.gen + 1),
  );
  for (const ring of lane.rings) {
    ring.r += cfg.ringSpeed * dtScale * 0.05;
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, cfg.opacity * (1 - ring.r / 400));
    ctx.strokeStyle = CONTACT_COLORS.trusted;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    for (const c of contacts) {
      const d = Math.hypot(c.x - origin.x, c.y - origin.y);
      if (Math.abs(d - ring.r) < cfg.catchRadius) {
        ctx.strokeStyle = CONTACT_COLORS[c.type];
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** IR-room breathing rings — one soft ring per phase. */
export function stepIrRoom(
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number },
  phase: number,
  opacity: number,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, opacity * 0.5);
  ctx.strokeStyle = CONTACT_COLORS.iot;
  const r = 12 + 26 * (0.5 - 0.5 * Math.cos(phase));
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
