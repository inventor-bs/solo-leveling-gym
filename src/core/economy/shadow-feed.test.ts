import { describe, it, expect } from "vitest";
import { weakenedExp, WEAKEN_AFTER_DAYS } from "@/core/shadow/grade";
import { effectiveDaysInactive } from "./shadow-feed";

describe("effectiveDaysInactive", () => {
  it("changes nothing for an unfed shadow", () => {
    expect(effectiveDaysInactive(9, 0)).toBe(9);
  });

  it("subtracts the days of feeding still in hand", () => {
    expect(effectiveDaysInactive(9, 3)).toBe(6);
  });

  it("never goes below zero, however long the feed has left", () => {
    expect(effectiveDaysInactive(1, 3)).toBe(0);
  });

  it("ignores an expired feed rather than adding days back", () => {
    expect(effectiveDaysInactive(9, -4)).toBe(9);
  });

  it("counts only whole days of feeding", () => {
    expect(effectiveDaysInactive(9, 2.9)).toBe(7);
  });

  it("delays weakening without touching the stored EXP", () => {
    const stored = 20_000;
    const days = WEAKEN_AFTER_DAYS + 2;
    // Unfed, this shadow has been decaying for three days.
    expect(weakenedExp(stored, days)).toBeLessThan(stored);
    // Fed, the same stored value is handed a smaller day count and holds.
    expect(weakenedExp(stored, effectiveDaysInactive(days, 3))).toBe(stored);
  });
});
