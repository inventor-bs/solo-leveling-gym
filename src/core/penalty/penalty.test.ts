import { describe, it, expect } from "vitest";
import { dailyQuestTargets } from "@/core/quest/daily-quest";
import {
  expAfterPenalty,
  survivalMultiplier,
  survivalTargets,
  isSystemSilent,
  applyPenaltyToStats,
} from "./penalty";

describe("expAfterPenalty", () => {
  it("removes exactly 10 percent", () => {
    expect(expAfterPenalty(1000)).toBe(900);
  });

  it("floors rather than inventing a fractional point", () => {
    expect(expAfterPenalty(95)).toBe(85); // 85.5 floored
  });

  it("is a no-op at zero and never goes negative", () => {
    expect(expAfterPenalty(0)).toBe(0);
  });

  it("REGRESSION: returns only the within-level pool, so level can never drop", () => {
    // The function has no level parameter and no level in its return type.
    // That is the guarantee — this test exists so a future refactor that
    // adds one has to justify itself.
    const result = expAfterPenalty(500);
    expect(typeof result).toBe("number");
    expect(result).toBeLessThan(500);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("takes the full 10% when no multiplier is given", () => {
    expect(expAfterPenalty(1000)).toBe(900);
    expect(expAfterPenalty(1000, 1)).toBe(900);
  });

  it("takes a fifth less of the loss with the Unyielding multiplier", () => {
    // 10% of 1000 is 100; Unyielding cuts that loss to 80.
    expect(expAfterPenalty(1000, 0.8)).toBe(920);
  });

  it("REGRESSION: still cannot push EXP below zero, whatever the multiplier", () => {
    expect(expAfterPenalty(0, 0.8)).toBe(0);
  });

  it("REGRESSION: still has no level parameter, so it still cannot delevel", () => {
    // Only currentExp is required — lossMultiplier is optional and defaulted,
    // so Function.length stays 1. A second REQUIRED parameter (a level) would
    // push it to 2, and a function that cannot see the level cannot lower it.
    expect(expAfterPenalty.length).toBe(1);
  });
});

describe("survivalMultiplier", () => {
  it("starts at 1.5 on the first day stuck", () => {
    expect(survivalMultiplier(0)).toBe(1.5);
  });

  it("adds 10 percent per additional day", () => {
    expect(survivalMultiplier(1)).toBe(1.6);
    expect(survivalMultiplier(2)).toBe(1.7);
  });

  it("REGRESSION: day 3 is exactly 1.8, not 1.8000000000000003", () => {
    // 1.5 + 3 * 0.1 drifts in binary floating point, and the drift survives
    // Math.ceil() as a phantom extra rep. Integer tenths avoid it entirely.
    expect(survivalMultiplier(3)).toBe(1.8);
    expect(Math.ceil(20 * survivalMultiplier(3))).toBe(36);
  });

  it("hard caps at 2x and never escalates past it", () => {
    expect(survivalMultiplier(5)).toBe(2);
    expect(survivalMultiplier(6)).toBe(2);
    expect(survivalMultiplier(400)).toBe(2);
  });

  it("treats a negative day count as day zero", () => {
    expect(survivalMultiplier(-3)).toBe(1.5);
  });
});

describe("survivalTargets", () => {
  it("scales an E-rank quest by 1.5 on the first day", () => {
    expect(survivalTargets(dailyQuestTargets("E"), 0)).toEqual({
      pushups: 30,
      situps: 30,
      squats: 30,
      runKm: 1.5,
    });
  });

  it("rounds reps up so the target is never quietly easier", () => {
    // 45 * 1.6 = 72 exactly; 45 * 1.7 = 76.5 must become 77, not 76.
    expect(survivalTargets(dailyQuestTargets("C"), 2).pushups).toBe(77);
  });

  it("keeps distance to one decimal place", () => {
    expect(survivalTargets(dailyQuestTargets("D"), 0).runKm).toBe(3);
    expect(survivalTargets(dailyQuestTargets("E"), 2).runKm).toBe(1.7);
  });

  it("never exceeds twice the base quest", () => {
    const base = dailyQuestTargets("S");
    const worst = survivalTargets(base, 99);
    expect(worst.pushups).toBe(base.pushups * 2);
    expect(worst.runKm).toBe(base.runKm * 2);
  });
});

describe("isSystemSilent", () => {
  it("stays vocal for the first six days", () => {
    expect(isSystemSilent(0)).toBe(false);
    expect(isSystemSilent(6)).toBe(false);
  });

  it("falls silent from day seven onward", () => {
    expect(isSystemSilent(7)).toBe(true);
    expect(isSystemSilent(30)).toBe(true);
  });
});

describe("applyPenaltyToStats", () => {
  const stats = {
    strength: 100,
    agility: 40,
    vitality: 33,
    intelligence: 0,
    perception: 61,
    luck: 7,
  };

  it("returns the stats untouched when no penalty is active", () => {
    expect(applyPenaltyToStats(stats, false)).toEqual(stats);
  });

  it("removes 15 percent from every stat when active", () => {
    expect(applyPenaltyToStats(stats, true)).toEqual({
      strength: 85,
      agility: 34,
      vitality: 28, // 28.05 floored
      intelligence: 0,
      perception: 51, // 51.85 floored
      luck: 5, // 5.95 floored
    });
  });

  it("REGRESSION: does not mutate the input, since the stored value must survive", () => {
    const original = { ...stats };
    applyPenaltyToStats(stats, true);
    expect(stats).toEqual(original);
  });
});
