import { describe, it, expect } from "vitest";
import {
  determineClass,
  secondAwakeningEligible,
  CLASS_CATALOG,
} from "./class";
import type { Stats } from "@/core/hunter/stats";

const baseStats: Stats = {
  strength: 50,
  agility: 50,
  vitality: 50,
  intelligence: 50,
  perception: 50,
  luck: 50,
};

describe("determineClass", () => {
  it("assigns Berserker when STR clearly dominates", () => {
    expect(determineClass({ ...baseStats, strength: 100 })).toBe("berserker");
  });

  it("assigns Assassin when AGI clearly dominates", () => {
    expect(determineClass({ ...baseStats, agility: 100 })).toBe("assassin");
  });

  it("assigns Tanker when VIT clearly dominates", () => {
    expect(determineClass({ ...baseStats, vitality: 100 })).toBe("tanker");
  });

  it("assigns Fighter when STR/AGI/VIT are roughly balanced", () => {
    expect(determineClass(baseStats)).toBe("fighter");
  });
});

describe("secondAwakeningEligible", () => {
  it("is false unless all 8 muscle-mapped shadows are Knight or better", () => {
    const sevenKnights = Array(7).fill("Knight" as const);
    expect(secondAwakeningEligible([...sevenKnights, "Elite"])).toBe(false);
    expect(secondAwakeningEligible([...sevenKnights, "Knight"])).toBe(true);
    expect(secondAwakeningEligible([...sevenKnights, "Marshal"])).toBe(true); // Marshal exceeds Knight
  });
});

it("CLASS_CATALOG lists Shadow Monarch last, marked hidden-until-eligible", () => {
  const monarch = CLASS_CATALOG[CLASS_CATALOG.length - 1]!;
  expect(monarch.id).toBe("shadow-monarch");
  expect(monarch.hiddenUntilEligible).toBe(true);
});
