import { describe, it, expect } from "vitest";
import {
  EQUIPMENT_CATALOG,
  dropChance,
  rollGrade,
  isHigherGrade,
  gradeBonus,
  equipmentExpMultiplier,
  equipmentFatigueGainMultiplier,
  equipmentQuestGoldMultiplier,
  isEquipmentSlot,
  isEquipmentGrade,
} from "./equipment";

describe("EQUIPMENT_CATALOG", () => {
  it("names one item per slot", () => {
    expect(EQUIPMENT_CATALOG.weapon.name).toBe("Knight Killer");
    expect(EQUIPMENT_CATALOG.armor.name).toBe("Shadow Compression Gear");
    expect(EQUIPMENT_CATALOG.accessory.name).toBe("Hunter's Charm");
  });
});

describe("dropChance", () => {
  it("uses the rank's base rate when LUCK is zero", () => {
    expect(dropChance("E", 0)).toBeCloseTo(0.03, 10);
    expect(dropChance("A", 0)).toBeCloseTo(0.15, 10);
  });

  it("rises with LUCK, by at most 0.1 at the cap", () => {
    expect(dropChance("E", 100)).toBeCloseTo(0.13, 10);
    expect(dropChance("A", 50)).toBeCloseTo(0.2, 10);
  });

  it("never goes below the base rate for a nonsense LUCK value", () => {
    expect(dropChance("C", -40)).toBeCloseTo(0.08, 10);
  });
});

describe("rollGrade", () => {
  it("lands in each band, weakest band widest", () => {
    expect(rollGrade(0)).toBe("common");
    expect(rollGrade(0.25)).toBe("common");
    expect(rollGrade(0.6)).toBe("uncommon");
    expect(rollGrade(0.85)).toBe("rare");
    expect(rollGrade(0.95)).toBe("epic");
    expect(rollGrade(0.99)).toBe("legendary");
  });

  it("returns legendary at the very top of the range", () => {
    // The cumulative weights sum to 1.0000000000000002 in IEEE-754, so a
    // roll a hair under 1 can fall past every band. That is what the
    // function's final return exists for.
    expect(rollGrade(0.9999999)).toBe("legendary");
  });

  it("clamps a roll outside [0, 1) instead of returning undefined", () => {
    expect(rollGrade(-1)).toBe("common");
    expect(rollGrade(2)).toBe("legendary");
  });
});

describe("isHigherGrade", () => {
  it("only replaces an existing item with a strictly better one", () => {
    expect(isHigherGrade("epic", "rare")).toBe(true);
    expect(isHigherGrade("rare", "epic")).toBe(false);
    expect(isHigherGrade("rare", "rare")).toBe(false);
  });

  it("treats an empty slot as always worth filling", () => {
    expect(isHigherGrade("common", null)).toBe(true);
  });
});

describe("grade effects", () => {
  it("scales from 5% to 25% across the ladder", () => {
    expect(gradeBonus("common")).toBeCloseTo(0.05, 10);
    expect(gradeBonus("legendary")).toBeCloseTo(0.25, 10);
    expect(gradeBonus(null)).toBe(0);
  });

  it("Knight Killer only pays on a session that trained Back", () => {
    expect(equipmentExpMultiplier("rare", 4_000)).toBeCloseTo(1.15, 10);
    expect(equipmentExpMultiplier("rare", 0)).toBe(1);
    expect(equipmentExpMultiplier(null, 4_000)).toBe(1);
  });

  it("Shadow Compression Gear reduces the fatigue GAIN, never the stored value", () => {
    expect(equipmentFatigueGainMultiplier("common")).toBeCloseTo(0.95, 10);
    expect(equipmentFatigueGainMultiplier("legendary")).toBeCloseTo(0.75, 10);
    expect(equipmentFatigueGainMultiplier(null)).toBe(1);
  });

  it("Hunter's Charm raises Daily Quest gold only", () => {
    expect(equipmentQuestGoldMultiplier("epic")).toBeCloseTo(1.2, 10);
    expect(equipmentQuestGoldMultiplier(null)).toBe(1);
  });
});

describe("runtime guards", () => {
  it("rejects a slot or grade that is not in the catalog", () => {
    expect(isEquipmentSlot("weapon")).toBe(true);
    expect(isEquipmentSlot("helmet")).toBe(false);
    expect(isEquipmentGrade("legendary")).toBe(true);
    expect(isEquipmentGrade("mythic")).toBe(false);
  });
});
