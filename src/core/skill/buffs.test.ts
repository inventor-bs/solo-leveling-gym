import { describe, it, expect } from "vitest";
import { WEAKEN_AFTER_DAYS, WEAKEN_RATE_PER_DAY } from "@/core/shadow/grade";
import {
  tenacityLossMultiplier,
  fatigueDecayMultiplier,
  shadowWeakenAfterDays,
  shadowWeakenRatePerDay,
  armyRankMode,
  shadowExpMultiplier,
  bloodlustGoldMultiplier,
  vitalStrikeBossMultiplier,
} from "./buffs";

const none = new Set<string>();

describe("skill buff functions", () => {
  it("tenacityLossMultiplier halves the penalty loss only when equipped", () => {
    expect(tenacityLossMultiplier(none)).toBe(1);
    expect(tenacityLossMultiplier(new Set(["tenacity"]))).toBe(0.5);
  });

  it("fatigueDecayMultiplier is 25% faster only when equipped", () => {
    expect(fatigueDecayMultiplier(none)).toBe(1);
    expect(fatigueDecayMultiplier(new Set(["advanced-regeneration"]))).toBe(
      1.25,
    );
  });

  it("shadowWeakenAfterDays extends the grace window only when equipped", () => {
    expect(shadowWeakenAfterDays(none)).toBe(WEAKEN_AFTER_DAYS);
    expect(shadowWeakenAfterDays(new Set(["iron-body"]))).toBe(10);
  });

  it("shadowWeakenRatePerDay halves the decay rate only when equipped", () => {
    expect(shadowWeakenRatePerDay(none)).toBe(WEAKEN_RATE_PER_DAY);
    expect(shadowWeakenRatePerDay(new Set(["shadow-preservation"]))).toBe(0.01);
  });

  it("armyRankMode switches to average only when equipped", () => {
    expect(armyRankMode(none)).toBe("weakest");
    expect(armyRankMode(new Set(["army-discipline"]))).toBe("average");
  });

  it("shadowExpMultiplier adds 10% only when equipped", () => {
    expect(shadowExpMultiplier(none)).toBe(1);
    expect(shadowExpMultiplier(new Set(["legion"]))).toBe(1.1);
  });

  it("bloodlustGoldMultiplier applies only at B-Rank or better, and only when equipped", () => {
    const withSkill = new Set(["bloodlust"]);
    expect(bloodlustGoldMultiplier(none, "B")).toBe(1);
    expect(bloodlustGoldMultiplier(withSkill, "C")).toBe(1);
    expect(bloodlustGoldMultiplier(withSkill, "B")).toBe(1.5);
    expect(bloodlustGoldMultiplier(withSkill, "A")).toBe(1.5);
  });

  it("vitalStrikeBossMultiplier is 1.5x by default and 2x when equipped", () => {
    expect(vitalStrikeBossMultiplier(none)).toBe(1.5);
    expect(vitalStrikeBossMultiplier(new Set(["vital-strike"]))).toBe(2);
  });
});
