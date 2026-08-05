import { describe, it, expect } from "vitest";
import { exp } from "@/core/shared/units";
import { expToNextLevel, applyExp, rankForLevel } from "./progression";

describe("expToNextLevel", () => {
  it("level 1 requires 100 EXP", () => {
    expect(expToNextLevel(1)).toBe(100);
  });

  it("increases monotonically with level", () => {
    for (let l = 1; l < 100; l++) {
      expect(expToNextLevel(l + 1)).toBeGreaterThan(expToNextLevel(l));
    }
  });

  it("always returns a positive integer", () => {
    for (const l of [1, 10, 28, 40, 99]) {
      const v = expToNextLevel(l);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("level 0 or negative is treated as level 1", () => {
    expect(expToNextLevel(0)).toBe(100);
    expect(expToNextLevel(-5)).toBe(100);
  });
});

describe("applyExp", () => {
  it("accumulates EXP without leveling up when not enough", () => {
    const r = applyExp(1, exp(0), exp(50));
    expect(r).toEqual({ level: 1, exp: 50, levelsGained: 0 });
  });

  it("levels up exactly once when EXP exactly meets the threshold", () => {
    const r = applyExp(1, exp(0), exp(100));
    expect(r.level).toBe(2);
    expect(r.exp).toBe(0);
    expect(r.levelsGained).toBe(1);
  });

  it("keeps the leftover EXP after leveling up", () => {
    const r = applyExp(1, exp(0), exp(130));
    expect(r.level).toBe(2);
    expect(r.exp).toBe(30);
  });

  it("levels up multiple times in one call if EXP is large enough", () => {
    const r = applyExp(1, exp(0), exp(100000));
    expect(r.levelsGained).toBeGreaterThan(5);
    expect(r.exp).toBeLessThan(expToNextLevel(r.level));
  });

  it("gaining 0 EXP changes nothing", () => {
    const r = applyExp(5, exp(42), exp(0));
    expect(r).toEqual({ level: 5, exp: 42, levelsGained: 0 });
  });

  it("negative EXP never causes a level to drop, floors at 0", () => {
    const r = applyExp(5, exp(42), exp(-100));
    expect(r.level).toBe(5);
    expect(r.exp).toBe(0);
    expect(r.levelsGained).toBe(0);
  });

  it("negative EXP within the same level keeps the remainder", () => {
    const r = applyExp(5, exp(200), exp(-50));
    expect(r.level).toBe(5);
    expect(r.exp).toBe(150);
  });
});

describe("rankForLevel", () => {
  it("maps level to rank by threshold", () => {
    expect(rankForLevel(1)).toBe("E");
    expect(rankForLevel(9)).toBe("E");
    expect(rankForLevel(10)).toBe("D");
    expect(rankForLevel(20)).toBe("C");
    expect(rankForLevel(35)).toBe("B");
    expect(rankForLevel(50)).toBe("A");
    expect(rankForLevel(70)).toBe("S");
    expect(rankForLevel(90)).toBe("National");
    expect(rankForLevel(100)).toBe("Monarch");
  });

  it("a level below 1 is still E", () => {
    expect(rankForLevel(0)).toBe("E");
  });

  it("a very high level is still Monarch", () => {
    expect(rankForLevel(999)).toBe("Monarch");
  });
});
