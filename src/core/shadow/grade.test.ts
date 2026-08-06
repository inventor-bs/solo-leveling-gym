import { describe, it, expect } from "vitest";
import {
  gradeForExp,
  weakenedExp,
  WEAKEN_AFTER_DAYS,
} from "./grade";

describe("gradeForExp", () => {
  it("starts at Normal with zero EXP", () => {
    expect(gradeForExp(0)).toBe("Normal");
  });

  it("climbs the ladder as EXP crosses each threshold", () => {
    expect(gradeForExp(4_999)).toBe("Normal");
    expect(gradeForExp(5_000)).toBe("Elite");
    expect(gradeForExp(14_999)).toBe("Elite");
    expect(gradeForExp(15_000)).toBe("Knight");
    expect(gradeForExp(39_999)).toBe("Knight");
    expect(gradeForExp(40_000)).toBe("Marshal");
    expect(gradeForExp(99_999)).toBe("Marshal");
    expect(gradeForExp(100_000)).toBe("Commander");
    expect(gradeForExp(249_999)).toBe("Commander");
    expect(gradeForExp(250_000)).toBe("Grand Marshal");
  });

  it("never exceeds Grand Marshal no matter how large EXP grows", () => {
    expect(gradeForExp(10_000_000)).toBe("Grand Marshal");
  });
});

describe("weakenedExp", () => {
  it("is untouched before the weaken threshold", () => {
    expect(weakenedExp(20_000, WEAKEN_AFTER_DAYS - 1)).toBe(20_000);
    expect(WEAKEN_AFTER_DAYS).toBe(7);
  });

  it("starts decaying at exactly the threshold", () => {
    const result = weakenedExp(20_000, WEAKEN_AFTER_DAYS);
    expect(result).toBeLessThan(20_000);
    expect(result).toBeGreaterThan(19_000);
  });

  it("REGRESSION: never drops more than one grade below the un-decayed grade, however long neglected", () => {
    // Raw stored EXP of 20,000 is Knight-grade. One tier down is Elite,
    // whose floor is 5,000 — 400 days of neglect must still land there,
    // not compound all the way down through every remaining tier.
    const oneYear = weakenedExp(20_000, 365);
    const wayTooLong = weakenedExp(20_000, 4_000);
    expect(oneYear).toBe(5_000);
    expect(wayTooLong).toBe(5_000);
    expect(gradeForExp(wayTooLong)).toBe("Elite");
  });

  it("Grand Marshal decays but floors at Commander's threshold, never below it", () => {
    const decayed = weakenedExp(300_000, 4_000);
    expect(decayed).toBe(100_000);
  });

  it("Normal-grade shadows floor at zero — there is no tier below Normal", () => {
    expect(weakenedExp(2_000, 4_000)).toBe(0);
  });

  it("treats a negative day count as no decay", () => {
    expect(weakenedExp(20_000, -5)).toBe(20_000);
  });
});
