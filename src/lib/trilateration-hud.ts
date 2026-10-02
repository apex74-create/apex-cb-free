import type { Fix, GeometricValidation } from "@/lib/webperms";

export type HudAnchor = {
  id: string;
  name: string;
  x: number;
  y: number;
  rssi: number | null;
  enabled: boolean;
};

/** Confidence 0..1 from anchor count, solve residual, and geometric validation. */
export function solveConfidence(
  fix: Fix | null,
  geometricValidation?: GeometricValidation,
): number {
  if (!fix) return 0;
  const geometry = Math.min(1, (fix.anchors - 2) / 4);
  const residual = 1 / (1 + Math.max(0, fix.radius) / 5);
  let baseConfidence = Math.max(0, Math.min(1, geometry * 0.45 + residual * 0.55));

  if (geometricValidation) {
    baseConfidence = Math.min(1, baseConfidence * 0.7 + geometricValidation.score * 0.3);
  }

  return baseConfidence;
}
