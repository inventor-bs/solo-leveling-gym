import { describe, it, expect } from "vitest";
import {
  penaltyExpLossMultiplier,
  sessionGoldMultiplier,
  sessionExpMultiplier,
  PENALTY_EXP_LOSS_MULTIPLIER,
  MORNING_GOLD_MULTIPLIER,
  RETURN_EXP_MULTIPLIER,
} from "./buffs";

describe("penaltyExpLossMultiplier", () => {
  it("is neutral with nothing equipped", () => {
    expect(penaltyExpLossMultiplier(null)).toBe(1);
  });

  it("is neutral when a different title is equipped", () => {
    expect(penaltyExpLossMultiplier("monarch-of-dawn")).toBe(1);
    expect(penaltyExpLossMultiplier("one-who-returned")).toBe(1);
  });

  it("cuts the loss by a fifth with Unyielding equipped", () => {
    expect(penaltyExpLossMultiplier("unyielding")).toBe(0.8);
    expect(PENALTY_EXP_LOSS_MULTIPLIER).toBe(0.8);
  });
});

describe("sessionGoldMultiplier", () => {
  it("is neutral with nothing equipped, morning or not", () => {
    expect(sessionGoldMultiplier(null, true)).toBe(1);
    expect(sessionGoldMultiplier(null, false)).toBe(1);
  });

  it("is neutral when a different title is equipped", () => {
    expect(sessionGoldMultiplier("unyielding", true)).toBe(1);
  });

  it("REGRESSION: pays nothing extra on an afternoon session, even with Monarch equipped", () => {
    expect(sessionGoldMultiplier("monarch-of-dawn", false)).toBe(1);
  });

  it("pays the bonus on a morning session with Monarch equipped", () => {
    expect(sessionGoldMultiplier("monarch-of-dawn", true)).toBe(1.15);
    expect(MORNING_GOLD_MULTIPLIER).toBe(1.15);
  });
});

describe("sessionExpMultiplier", () => {
  it("is neutral with nothing equipped", () => {
    expect(sessionExpMultiplier(null, true)).toBe(1);
  });

  it("is neutral when a different title is equipped", () => {
    expect(sessionExpMultiplier("unyielding", true)).toBe(1);
  });

  it("REGRESSION: is neutral on an ordinary session, even with One Who Returned equipped", () => {
    // The buff is a welcome-back boost, not a permanent +10% EXP.
    expect(sessionExpMultiplier("one-who-returned", false)).toBe(1);
  });

  it("pays the bonus on the first session after an escape", () => {
    expect(sessionExpMultiplier("one-who-returned", true)).toBe(1.1);
    expect(RETURN_EXP_MULTIPLIER).toBe(1.1);
  });
});
