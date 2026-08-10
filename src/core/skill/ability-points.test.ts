import { describe, it, expect } from "vitest";
import { apEarnedForLevel } from "./ability-points";

describe("apEarnedForLevel", () => {
  it("pays 0 AP at level 1, rank E — no level-up and no rank-up has happened yet", () => {
    expect(apEarnedForLevel(1, "E")).toBe(0);
  });

  it("pays 1 AP per level gained, with no rank-up yet", () => {
    expect(apEarnedForLevel(5, "E")).toBe(4);
  });

  it("pays +5 AP the moment a rank threshold is crossed, on top of level AP", () => {
    // Level 10 is the D-rank threshold: 9 level-ups (9 AP) + 1 rank-up (5 AP).
    expect(apEarnedForLevel(10, "D")).toBe(14);
  });

  it("stacks every rank-up crossed on the way to the given level", () => {
    // Level 35 is the B-rank threshold: D(10), C(20), B(35) = 3 rank-ups.
    expect(apEarnedForLevel(35, "B")).toBe(34 + 5 * 3);
  });

  it("is monotonically non-decreasing in level", () => {
    for (let level = 1; level < 100; level++) {
      expect(apEarnedForLevel(level + 1, "E")).toBeGreaterThanOrEqual(
        apEarnedForLevel(level, "E"),
      );
    }
  });
});
