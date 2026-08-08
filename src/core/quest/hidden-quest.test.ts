import { describe, it, expect } from "vitest";
import {
  evaluateSeventhDay,
  SEVENTH_DAY,
  SEVENTH_DAY_GOLD_PER_ACTIVE_DAY,
  SEVENTH_DAY_WINDOW_DAYS,
} from "./hidden-quest";

describe("evaluateSeventhDay", () => {
  it("stays hidden before the seventh day, however much was trained", () => {
    const out = evaluateSeventhDay({ daysSinceStart: 6, activeDays: 6 });
    expect(out).toEqual({ revealed: false, goldAwarded: 0 });
  });

  it("REGRESSION: stays hidden on day 7 when nothing was ever trained", () => {
    // Revealing here would pay Progression currency for the passage of
    // time, which nothing in this app is allowed to do.
    const out = evaluateSeventhDay({ daysSinceStart: 7, activeDays: 0 });
    expect(out).toEqual({ revealed: false, goldAwarded: 0 });
  });

  it("reveals on day 7 after a single day of real training", () => {
    const out = evaluateSeventhDay({ daysSinceStart: 7, activeDays: 1 });
    expect(out.revealed).toBe(true);
    expect(out.goldAwarded).toBe(SEVENTH_DAY_GOLD_PER_ACTIVE_DAY);
  });

  it("pays strictly in proportion to the days actually trained", () => {
    expect(
      evaluateSeventhDay({ daysSinceStart: 7, activeDays: 3 }).goldAwarded,
    ).toBe(3 * SEVENTH_DAY_GOLD_PER_ACTIVE_DAY);
    expect(
      evaluateSeventhDay({ daysSinceStart: 7, activeDays: 7 }).goldAwarded,
    ).toBe(7 * SEVENTH_DAY_GOLD_PER_ACTIVE_DAY);
  });

  it("REGRESSION: cannot pay for more days than the window contains", () => {
    const out = evaluateSeventhDay({ daysSinceStart: 7, activeDays: 40 });
    expect(out.goldAwarded).toBe(
      SEVENTH_DAY_WINDOW_DAYS * SEVENTH_DAY_GOLD_PER_ACTIVE_DAY,
    );
  });

  it("still reveals long after day 7 for a hunter who arrives late", () => {
    const out = evaluateSeventhDay({ daysSinceStart: 200, activeDays: 2 });
    expect(out.revealed).toBe(true);
  });

  it("names a quest whose reveal line follows the voice rules", () => {
    expect(SEVENTH_DAY.id).toBe("the-seventh-day");
    const sentences = SEVENTH_DAY.revealLine
      .split(/(?<=[.!])\s+/)
      .filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(3);
    expect(SEVENTH_DAY.revealLine).not.toMatch(/\d/);
  });
});
