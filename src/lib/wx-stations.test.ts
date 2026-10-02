import { describe, expect, it } from "vitest";
import { parseAprsWx, blendStations, ageWeight, calculateAdvectionArrival, advectionBoost, type StationObs } from "./wx-stations";

describe("parseAprsWx", () => {
  it("decodes a position+weather report", () => {
    const o = parseAprsWx("N0CALL>APRS:!4500.00N/08440.00W_220/004g005t045r010p000P000h85b10132", 1);
    expect(o).toMatchObject({ id: "aprs:N0CALL", windDir: 220, windMph: 4, gustMph: 5, tempF: 45, rh: 85, pressureHpa: 1013.2, rainIn: 0.1 });
    expect(o!.lat).toBeCloseTo(45, 3);
    expect(o!.lon).toBeCloseTo(-84.6667, 3);
  });
  it("handles missing fields and h00 = 100%", () => {
    const o = parseAprsWx("K8ABC-13>APRS:@092345z4500.00N/08440.00W_.../...g...t-05h00", 1);
    expect(o).toMatchObject({ tempF: -5, rh: 100, windMph: undefined, gustMph: undefined });
  });
  it("rejects non-weather packets", () => {
    expect(parseAprsWx("N0CALL>APRS:>status text")).toBeNull();
  });
});

describe("blendStations", () => {
  it("weights closer stations and drops impossible values", () => {
    const now = Date.now();
    const s = (id: string, lat: number, tempF: number): StationObs => ({ id, name: id, source: "nws", lat, lon: 0, at: now, tempF });
    const b = blendStations(0, 0, [s("a", 0.01, 40), s("b", 0.2, 50), s("c", 0.01, 400)]);
    expect(b!.count).toBe(3);
    expect(b!.tempF!).toBeGreaterThan(40);
    expect(b!.tempF!).toBeLessThan(45);
  });
});

describe("kinematic weighting", () => {
  it("decays exponentially with age", () => {
    expect(ageWeight(0)).toBe(1);
    expect(ageWeight(15 * 60_000)).toBeCloseTo(Math.exp(-1), 5);
  });
  it("flags an upwind gust about to arrive", () => {
    const now = Date.now();
    // station ~10 mi west, wind from west at 24 mph → 25 min transit; reported 23 min ago
    const s = { lat: 45, lon: -84.2045, at: now - 23 * 60_000, windDir: 270, windMph: 24 };
    const a = calculateAdvectionArrival(45, -84, s, now)!;
    expect(a.etaMin).toBeGreaterThan(0);
    expect(a.etaMin).toBeLessThan(5);
    expect(advectionBoost(a)).toBeGreaterThan(2);
  });
  it("ignores downwind stations", () => {
    const s = { lat: 45, lon: -83.8, at: Date.now(), windDir: 270, windMph: 24 };
    expect(calculateAdvectionArrival(45, -84, s)).toBeNull();
  });
});
