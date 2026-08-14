import { describe, it, expect } from "vitest";
import { AURA_VISUAL_MAX_LEVEL } from "@/core/economy/pricing";
import { auraCost, auraVisualTier } from "./aura";

describe("auraCost", () => {
  it("matches the published ladder exactly", () => {
    expect(auraCost(0)).toBe(3_000);
    expect(auraCost(1)).toBe(4_500);
    expect(auraCost(2)).toBe(6_750);
    expect(auraCost(3)).toBe(10_125);
    expect(auraCost(4)).toBe(15_188);
    expect(auraCost(5)).toBe(22_781);
    expect(auraCost(6)).toBe(34_172);
  });

  it("rounds the one price on the ladder that actually lands on a half", () => {
    // 3000 * 1.5**4 is exactly 15187.5 in IEEE-754 (1.5**n is 3^n/2^n, an
    // exact binary fraction at this size), so this is a genuine rounding
    // decision rather than float drift — and it must round up, once, to a
    // single fixed integer the Store and the purchase both agree on.
    expect(3_000 * 1.5 ** 4).toBe(15_187.5);
    expect(auraCost(4)).toBe(15_188);
  });

  it("is strictly increasing across the whole plausible range", () => {
    for (let level = 0; level < 30; level++) {
      expect(auraCost(level + 1)).toBeGreaterThan(auraCost(level));
    }
  });

  it("keeps climbing far past the point the glow stops changing", () => {
    expect(auraCost(AURA_VISUAL_MAX_LEVEL + 5)).toBeGreaterThan(
      auraCost(AURA_VISUAL_MAX_LEVEL),
    );
  });
});

describe("auraVisualTier", () => {
  it("is off at zero and steps one per level up to the cap", () => {
    expect(auraVisualTier(0)).toBe(0);
    expect(auraVisualTier(1)).toBe(1);
    expect(auraVisualTier(4)).toBe(4);
    expect(auraVisualTier(5)).toBe(5);
  });

  it("saturates and never exceeds the cap, however much was bought", () => {
    // Deliberate, not a bug: buying past the cap still costs escalating
    // gold and still increments the stored level, and changes nothing on
    // screen. The economy needs a sink with no ceiling; the screen has one.
    expect(auraVisualTier(6)).toBe(5);
    expect(auraVisualTier(50)).toBe(5);
    expect(auraVisualTier(1_000)).toBe(AURA_VISUAL_MAX_LEVEL);
  });

  it("treats a nonsensical stored level as no aura rather than throwing", () => {
    expect(auraVisualTier(-1)).toBe(0);
  });
});
