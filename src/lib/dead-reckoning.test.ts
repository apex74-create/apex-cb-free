import { describe, expect, it } from "vitest";
import {
  createDeadReckoner,
  createStepDetector,
  driftRadius,
  projectPoint,
} from "@/lib/dead-reckoning";

describe("projectPoint", () => {
  it("walks north by the given distance", () => {
    const p = projectPoint(44.0, -84.0, 0, 100);
    expect(p.lat).toBeGreaterThan(44.0);
    expect(Math.abs(p.lon + 84.0)).toBeLessThan(1e-6);
    expect((p.lat - 44.0) * 111_320).toBeCloseTo(100, 0);
  });

  it("walks east without changing latitude", () => {
    const p = projectPoint(44.0, -84.0, 90, 100);
    expect(Math.abs(p.lat - 44.0)).toBeLessThan(1e-5);
    expect(p.lon).toBeGreaterThan(-84.0);
  });
});

describe("step detector", () => {
  const walk = (steps: number) => {
    const det = createStepDetector();
    let t = 0;
    let found = 0;
    for (let i = 0; i < steps; i++) {
      // one stride: settle, dip, strike
      for (const m of [9.81, 9.81, 7.5, 7.0, 12.6, 13.0, 9.81]) {
        t += 60;
        if (det.push(m, t)) found += 1;
      }
    }
    return found;
  };

  it("counts footfalls on a rhythmic walk", () => {
    expect(walk(10)).toBeGreaterThanOrEqual(8);
  });

  it("ignores a device sitting still", () => {
    const det = createStepDetector();
    let t = 0;
    let found = 0;
    for (let i = 0; i < 200; i++) {
      t += 20;
      if (det.push(9.81 + (i % 2 ? 0.05 : -0.05), t)) found += 1;
    }
    expect(found).toBe(0);
  });
});

describe("dead reckoner", () => {
  it("advances on steps and re-seeds on a fresh fix", () => {
    const dr = createDeadReckoner();
    dr.fix(44.0, -84.0, 10, Date.now());
    expect(dr.state()?.source).toBe("gps");

    for (let i = 0; i < 20; i++) dr.step(0.75, 0);
    const s = dr.state()!;
    expect(s.source).toBe("inertial");
    expect(s.steps).toBe(20);
    expect(s.walked).toBeCloseTo(15, 5);
    expect(s.lat).toBeGreaterThan(44.0);
    expect(s.acc).toBeGreaterThan(10);

    dr.fix(44.5, -84.5, 8, Date.now());
    const f = dr.state()!;
    expect(f.source).toBe("gps");
    expect(f.walked).toBe(0);
    expect(f.lat).toBe(44.5);
  });

  it("holds still when no bearing is known", () => {
    const dr = createDeadReckoner();
    dr.fix(44.0, -84.0, 10, Date.now());
    dr.step(0.75, null);
    expect(dr.state()?.source).toBe("gps");
  });

  it("grows the ring with distance walked", () => {
    expect(driftRadius(10, 0)).toBeLessThan(driftRadius(10, 100));
  });
});
