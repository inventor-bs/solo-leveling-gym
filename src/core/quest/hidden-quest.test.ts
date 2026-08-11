import { describe, it, expect } from "vitest";
import {
  evaluateSeventhDay,
  SEVENTH_DAY,
  SEVENTH_DAY_GOLD_PER_ACTIVE_DAY,
  SEVENTH_DAY_WINDOW_DAYS,
  evaluateFiveDayStreak,
  FIVE_DAY_STREAK_GOLD,
  evaluateFirstRecord,
  FIRST_RECORD_GOLD,
  evaluateEarlyRiser,
  EARLY_RISER_GOLD,
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

describe("evaluateFiveDayStreak", () => {
  it("is not revealed below the 5-day threshold", () => {
    expect(
      evaluateFiveDayStreak({ streakDays: 4, stealthEquipped: false }),
    ).toEqual({
      revealed: false,
      goldAwarded: 0,
    });
  });

  it("reveals at the 5-day threshold and pays a flat amount", () => {
    expect(
      evaluateFiveDayStreak({ streakDays: 5, stealthEquipped: false }),
    ).toEqual({
      revealed: true,
      goldAwarded: FIVE_DAY_STREAK_GOLD,
    });
  });

  it("Stealth lowers the threshold to 3 days", () => {
    expect(
      evaluateFiveDayStreak({ streakDays: 3, stealthEquipped: false }).revealed,
    ).toBe(false);
    expect(
      evaluateFiveDayStreak({ streakDays: 3, stealthEquipped: true }).revealed,
    ).toBe(true);
  });
});

describe("evaluateFirstRecord", () => {
  it("is not revealed with zero PRs logged", () => {
    expect(evaluateFirstRecord({ prCountEver: 0 })).toEqual({
      revealed: false,
      goldAwarded: 0,
    });
  });

  it("reveals on the first PR", () => {
    expect(evaluateFirstRecord({ prCountEver: 1 })).toEqual({
      revealed: true,
      goldAwarded: FIRST_RECORD_GOLD,
    });
  });
});

describe("evaluateEarlyRiser", () => {
  it("is not revealed without an early session", () => {
    expect(evaluateEarlyRiser({ hasEarlySession: false })).toEqual({
      revealed: false,
      goldAwarded: 0,
    });
  });

  it("reveals on the first session started before 07:00", () => {
    expect(evaluateEarlyRiser({ hasEarlySession: true })).toEqual({
      revealed: true,
      goldAwarded: EARLY_RISER_GOLD,
    });
  });
});
