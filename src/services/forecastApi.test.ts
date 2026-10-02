import { describe, expect, it } from "vitest";
import {
  inIndianSummerWindow,
  timelineLabelToIsoDate,
  tierDayLimit,
  trimTimelineByTier,
  type WaveTimelinePoint,
} from "@/services/forecastApi";

function fakeTimeline(days: number, startIso = "2026-09-01"): WaveTimelinePoint[] {
  const start = new Date(`${startIso}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getTime() + i * 86400000);
    const iso = day.toISOString().slice(0, 10);
    return {
      date: `Sep ${String(i + 1).padStart(2, "0")}`,
      iso,
      temp: 70 + i,
      baseline: 65 + i,
      elNino: 68 + i,
    };
  });
}

describe("forecastApi tier limits", () => {
  it("applies free/pro/enterprise day limits", () => {
    expect(tierDayLimit("free")).toBe(7);
    expect(tierDayLimit("pro")).toBe(62);
    expect(tierDayLimit("enterprise")).toBe(62);
  });

  it("keeps measured history and limits only forward days on the free tier", () => {
    // 10 days of measured history, then 52 forward days.
    const trimmed = trimTimelineByTier(fakeTimeline(62), "free", "2026-09-10");
    const past = trimmed.filter((p) => p.iso && p.iso <= "2026-09-10");
    const forward = trimmed.filter((p) => p.iso && p.iso > "2026-09-10");
    expect(past).toHaveLength(10);
    expect(forward).toHaveLength(7);
  });

  it("does not limit forward days for paid tiers", () => {
    const trimmed = trimTimelineByTier(fakeTimeline(62), "enterprise", "2026-09-10");
    expect(trimmed).toHaveLength(62);
  });
});

describe("forecastApi target window", () => {
  it("flags indian summer date window", () => {
    expect(inIndianSummerWindow("2026-09-22")).toBe(true);
    expect(inIndianSummerWindow("2026-10-06")).toBe(true);
    expect(inIndianSummerWindow("2026-10-07")).toBe(false);
  });

  it("parses timeline labels to iso date", () => {
    const parsed = timelineLabelToIsoDate("Sep 24");
    expect(parsed.slice(5, 10)).toBe("09-24");
  });

  it("rolls december forecasts into january of the next year", () => {
    const parsed = timelineLabelToIsoDate("Jan 02", new Date("2026-12-30T00:00:00Z"));
    expect(parsed).toBe("2027-01-02");
  });

  it("falls back safely for invalid timeline labels", () => {
    const parsed = timelineLabelToIsoDate("not-a-date");
    expect(parsed.endsWith("-01-01")).toBe(true);
  });
});
