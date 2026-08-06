import { describe, it, expect } from "vitest";
import {
  dungeonBreakMultiplier,
  carriedSets,
  DUNGEON_BREAK_CAP,
} from "./dungeon-break";

describe("dungeonBreakMultiplier", () => {
  it("is 1 when nothing was skipped", () => {
    expect(dungeonBreakMultiplier(0)).toBe(1);
  });

  it("adds 20 percent for a single skipped session", () => {
    expect(dungeonBreakMultiplier(1)).toBe(1.2);
  });

  it("REGRESSION: caps at +40 percent no matter how many were skipped", () => {
    // Without the cap, a two-week absence would return a session nobody
    // could finish, which turns a nudge into a reason to quit.
    expect(dungeonBreakMultiplier(2)).toBe(DUNGEON_BREAK_CAP);
    expect(dungeonBreakMultiplier(3)).toBe(DUNGEON_BREAK_CAP);
    expect(dungeonBreakMultiplier(50)).toBe(DUNGEON_BREAK_CAP);
    expect(DUNGEON_BREAK_CAP).toBe(1.4);
  });

  it("treats a negative count as none skipped", () => {
    expect(dungeonBreakMultiplier(-2)).toBe(1);
  });
});

describe("carriedSets", () => {
  it("leaves the plan alone when nothing was skipped", () => {
    expect(carriedSets(4, 0)).toBe(4);
  });

  it("rounds to the nearest whole set", () => {
    expect(carriedSets(4, 1)).toBe(5); // 4.8 -> 5
    expect(carriedSets(3, 1)).toBe(4); // 3.6 -> 4
  });

  it("never returns fewer sets than the plan asked for", () => {
    for (let base = 1; base <= 6; base++) {
      for (let missed = 0; missed <= 5; missed++) {
        expect(carriedSets(base, missed)).toBeGreaterThanOrEqual(base);
      }
    }
  });
});
