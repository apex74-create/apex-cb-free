import { describe, expect, it } from "vitest";
import { type ExpandableLicence, expandLicences, isGrantAll } from "./entitlement";

const base: Omit<ExpandableLicence, "product_slug"> = {
  licence_key: "APEX-00000-00000-00000",
  status: "active",
  expires_at: null,
  created_at: "2026-01-01",
};

describe("entitlement expansion", () => {
  it("recognises the standing grants", () => {
    expect(isGrantAll("tremor-full")).toBe(true);
    expect(isGrantAll("apex-full-stack")).toBe(true);
    expect(isGrantAll("apex-signal-watch")).toBe(false);
  });

  it("leaves an unbundled single-product licence untouched", () => {
    const held = [{ ...base, product_slug: "weather-basic" }];
    expect(expandLicences(held, ["weather-basic", "tremor-map-engine"])).toHaveLength(1);
  });

  it("adds the fixed bundle but not the whole catalogue", () => {
    const held = [{ ...base, product_slug: "apex-signal-watch" }];
    const out = expandLicences(held, ["apex-signal-watch", "tremor-map-engine", "apex-shield"]);
    const slugs = out.map((l) => l.product_slug);
    expect(slugs).toContain("weather-basic");
    expect(slugs).not.toContain("apex-shield");
  });

  it("unlocks every shipping product from a standing grant", () => {
    const held = [{ ...base, product_slug: "tremor-full" }];
    const out = expandLicences(held, ["tremor-map-engine", "apex-signal-watch"]);
    expect(out.map((l) => l.product_slug).sort()).toEqual([
      "apex-signal-watch",
      "tremor-full",
      "tremor-map-engine",
    ]);
    expect(out.filter((l) => l.derived)).toHaveLength(2);
  });

  it("covers products that ship after the purchase", () => {
    const held = [{ ...base, product_slug: "tremor-full" }];
    const later = expandLicences(held, ["tremor-map-engine", "brand-new-app"]);
    expect(later.map((l) => l.product_slug)).toContain("brand-new-app");
  });

  it("never duplicates a directly held product", () => {
    const held = [
      { ...base, product_slug: "apex-full-stack" },
      { ...base, product_slug: "tremor-map-engine", licence_key: "APEX-DIRECT" },
    ];
    const out = expandLicences(held, ["tremor-map-engine"]);
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.product_slug === "tremor-map-engine")?.licence_key).toBe("APEX-DIRECT");
  });

  it("ignores a cancelled grant", () => {
    const held = [{ ...base, status: "cancelled", product_slug: "apex-full-stack" }];
    expect(expandLicences(held, ["tremor-map-engine"])).toHaveLength(1);
  });
});
