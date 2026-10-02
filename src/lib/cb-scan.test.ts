import { describe, expect, it } from "vitest";
import { scanBlocks, scanPath } from "./cb-scan";
describe("block scanner", () => {
  it("splits into 20-channel blocks", () => {
    expect(scanBlocks(40).map((b) => [b.from, b.to])).toEqual([[1, 20], [21, 40]]);
    expect(scanBlocks(1600)).toHaveLength(80);
  });
  it("reports up the chain", () => {
    expect(scanPath(47, 40)).toEqual([3, 47]);
    expect(scanPath(1600, 1600)).toEqual([4, 80, 1600]);
  });
});
import { assignScanGroups, blockSizeFor, SCAN_CEILING } from "./cb-scan";
describe("efficiency ceiling", () => {
  it("caps one device at 270 and splits the rest", () => {
    expect(SCAN_CEILING).toBe(270);
    expect(blockSizeFor(40)).toBe(20);
    expect(blockSizeFor(270)).toBe(90);
    expect(assignScanGroups(1600)).toHaveLength(6);
  });
});
