import { describe, it, expect } from "vitest";
import {
  fatigueAfterSession,
  decayFatigue,
  fatigueLevel,
  expMultiplierForFatigue,
} from "./fatigue";

describe("fatigueAfterSession", () => {
  it("a session matching the average adds exactly the base amount", () => {
    expect(fatigueAfterSession(0, 10000, 10000)).toBe(20);
  });

  it("a session 1.5x the average adds more", () => {
    expect(fatigueAfterSession(0, 15000, 10000)).toBe(30);
  });

  it("a lighter session adds less", () => {
    expect(fatigueAfterSession(0, 5000, 10000)).toBe(10);
  });

  it("accumulates on top of the current value", () => {
    expect(fatigueAfterSession(30, 10000, 10000)).toBe(50);
  });

  it("is capped at 100", () => {
    expect(fatigueAfterSession(95, 20000, 10000)).toBe(100);
  });

  it("with no history (average 0), uses the base amount", () => {
    expect(fatigueAfterSession(0, 10000, 0)).toBe(20);
  });
});

describe("decayFatigue", () => {
  it("drops by 12 points per day under normal sleep", () => {
    expect(decayFatigue(50, 1, false)).toBe(38);
  });

  it("drops faster with enough sleep", () => {
    expect(decayFatigue(50, 1, true)).toBe(32);
  });

  it("accumulates over multiple days", () => {
    expect(decayFatigue(50, 3, false)).toBe(14);
  });

  it("floors at 0, never goes negative", () => {
    expect(decayFatigue(10, 5, false)).toBe(0);
  });

  it("0 days changes nothing", () => {
    expect(decayFatigue(50, 0, false)).toBe(50);
  });
});

describe("fatigueLevel", () => {
  it("below 70 is normal", () => {
    expect(fatigueLevel(0)).toBe("normal");
    expect(fatigueLevel(69)).toBe("normal");
  });

  it("70 up to (but under) 85 is warning", () => {
    expect(fatigueLevel(70)).toBe("warning");
    expect(fatigueLevel(84)).toBe("warning");
  });

  it("85 and above is critical", () => {
    expect(fatigueLevel(85)).toBe("critical");
    expect(fatigueLevel(100)).toBe("critical");
  });
});

describe("expMultiplierForFatigue", () => {
  it("normal and warning don't reduce EXP", () => {
    expect(expMultiplierForFatigue(50)).toBe(1);
    expect(expMultiplierForFatigue(80)).toBe(1);
  });

  it("critical halves EXP", () => {
    expect(expMultiplierForFatigue(85)).toBe(0.5);
    expect(expMultiplierForFatigue(100)).toBe(0.5);
  });
});
