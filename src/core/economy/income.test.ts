import { describe, it, expect } from "vitest";
import { goldForPrs, goldForLevelUps } from "./income";

describe("goldForPrs", () => {
  it("pays nothing when nothing was broken", () => {
    expect(goldForPrs(0)).toBe(0);
  });

  it("pays 150 per PR, once per entry in the array", () => {
    expect(goldForPrs(1)).toBe(150);
    expect(goldForPrs(3)).toBe(450);
  });

  it("accepts a different per-PR rate, which is what a Boss Raid pays", () => {
    expect(goldForPrs(2, 300)).toBe(600);
  });

  it("never pays for a negative count", () => {
    expect(goldForPrs(-2)).toBe(0);
  });
});

describe("goldForLevelUps", () => {
  it("pays nothing when no level was crossed", () => {
    expect(goldForLevelUps(20, 20)).toBe(0);
  });

  it("pays 100 times the NEW level for a single level-up", () => {
    // 20 -> 21 pays 100 * 21.
    expect(goldForLevelUps(20, 21)).toBe(2_100);
  });

  it("sums every level crossed in one jump rather than paying once", () => {
    // 20 -> 22 pays 100*21 + 100*22.
    expect(goldForLevelUps(20, 22)).toBe(4_300);
    // 1 -> 4 pays 200 + 300 + 400.
    expect(goldForLevelUps(1, 4)).toBe(900);
  });

  it("pays nothing if the level somehow went backwards", () => {
    expect(goldForLevelUps(30, 20)).toBe(0);
  });
});
