import { describe, it, expect } from "vitest";
import { slotCapacity, SKILL_SLOTS_BASE, SKILL_SLOTS_MAX } from "./slots";

describe("slotCapacity", () => {
  it("starts at the base capacity with no Rune Stones bought", () => {
    expect(slotCapacity(0)).toBe(SKILL_SLOTS_BASE);
  });

  it("adds one slot per Rune Stone", () => {
    expect(slotCapacity(2)).toBe(SKILL_SLOTS_BASE + 2);
  });

  it("caps at the maximum no matter how many are purchased", () => {
    expect(slotCapacity(999)).toBe(SKILL_SLOTS_MAX);
  });
});
