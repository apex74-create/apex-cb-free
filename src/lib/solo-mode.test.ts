/**
 * Solo Miner Mode — geometric validation tests.
 * Verifies GDOP-based anchor spread scoring used by the trilateration HUD.
 */

import { describe, expect, it } from "vitest";
import { validateGeometry, type Anchor, type Fix } from "@/lib/webperms";

const fixAt = (x: number, y: number, anchors: number): Fix => ({ x, y, radius: 1, anchors });

/** Anchors evenly distributed on a circle of given radius around the origin. */
function ring(count: number, radius: number, rssi = -50): Anchor[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      id: `a${i}`,
      x: radius * Math.cos(a),
      y: radius * Math.sin(a),
      rssi,
    };
  });
}

describe("validateGeometry", () => {
  it("rejects fewer than three anchors", () => {
    const result = validateGeometry(ring(2, 10), fixAt(0, 0, 2));
    expect(result.isValid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.geometryQuality).toBe(0);
  });

  it("scores an equidistant square of anchors as ideal geometry", () => {
    const result = validateGeometry(ring(4, 10), fixAt(0, 0, 4));
    expect(result.geometryQuality).toBeCloseTo(1, 5);
    expect(result.bearingConsistency).toBeCloseTo(1, 5);
    expect(result.gdop).toBeCloseTo(1, 5);
    expect(result.isValid).toBe(true);
  });

  it("scores an evenly spread triangle as ideal geometry", () => {
    const result = validateGeometry(ring(3, 10), fixAt(0, 0, 3));
    expect(result.geometryQuality).toBeCloseTo(1, 5);
    expect(result.bearingConsistency).toBeCloseTo(1, 5);
    expect(result.isValid).toBe(true);
  });

  it("penalises collinear anchors (degenerate geometry)", () => {
    // Fix sits on the same line as the anchors, so every bearing is identical.
    const anchors: Anchor[] = [
      { id: "a1", x: 10, y: 0, rssi: -50 },
      { id: "a2", x: 20, y: 0, rssi: -50 },
      { id: "a3", x: 30, y: 0, rssi: -50 },
    ];
    const result = validateGeometry(anchors, fixAt(-10, 0, 3));
    expect(result.geometryQuality).toBeLessThan(0.3);
    expect(result.gdop).toBeGreaterThan(3);
  });

  it("penalises anchors clustered in one direction", () => {
    const anchors: Anchor[] = [
      { id: "a1", x: 10, y: 0, rssi: -50 },
      { id: "a2", x: 10, y: 1, rssi: -50 },
      { id: "a3", x: 10, y: 2, rssi: -50 },
    ];
    const clustered = validateGeometry(anchors, fixAt(0, 0, 3));
    const spread = validateGeometry(ring(3, 10), fixAt(0, 0, 3));
    expect(clustered.geometryQuality).toBeLessThan(spread.geometryQuality);
    expect(clustered.bearingConsistency).toBeLessThan(spread.bearingConsistency);
  });

  it("improves geometry quality as more evenly spread anchors are added", () => {
    const three = validateGeometry(ring(3, 10), fixAt(0, 0, 3));
    const six = validateGeometry(ring(6, 10), fixAt(0, 0, 6));
    expect(six.gdop).toBeLessThan(three.gdop);
    expect(six.geometryQuality).toBeGreaterThanOrEqual(three.geometryQuality - 1e-9);
  });

  it("ignores an anchor sitting exactly on the fix without crashing", () => {
    const anchors: Anchor[] = [...ring(3, 10), { id: "same", x: 0, y: 0, rssi: -30 }];
    const result = validateGeometry(anchors, fixAt(0, 0, 4));
    expect(Number.isFinite(result.gdop)).toBe(true);
    expect(result.geometryQuality).toBeGreaterThan(0.9);
  });

  it("keeps every metric within 0..1 bounds", () => {
    const result = validateGeometry(ring(5, 25), fixAt(1, -2, 5));
    for (const value of [
      result.geometryQuality,
      result.bearingConsistency,
      result.radiusVariance,
      result.score,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
