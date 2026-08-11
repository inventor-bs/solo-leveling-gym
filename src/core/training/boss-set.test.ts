import { describe, it, expect } from "vitest";
import { reps, kg } from "@/core/shared/units";
import { bossSets, bossSetExp, BOSS_SET_BASE_EXP } from "./boss-set";
import type { LoggedSet } from "./types";

const catalog = new Map([
  ["squat", { isMainLift: true, kind: "compound" as const }],
  ["leg-curl", { isMainLift: false, kind: "isolation" as const }],
  ["bench", { isMainLift: true, kind: "compound" as const }],
]);

const set = (
  exerciseId: string,
  setIndex: number,
  completed = true,
): LoggedSet => ({
  exerciseId,
  setIndex,
  reps: reps(8),
  weight: kg(60),
  completed,
});

describe("bossSets", () => {
  it("counts the last completed set of each main-compound-lift exercise, one per exercise", () => {
    const sets = [
      set("squat", 0),
      set("squat", 1),
      set("squat", 2),
      set("leg-curl", 0),
    ];
    expect(bossSets(sets, catalog)).toBe(1); // squat's set index 2, leg-curl never counts
  });

  it("counts one BOSS set per qualifying exercise in the session", () => {
    const sets = [
      set("squat", 0),
      set("squat", 1),
      set("bench", 0),
      set("bench", 1),
    ];
    expect(bossSets(sets, catalog)).toBe(2);
  });

  it("ignores an incomplete final set — the BOSS set must have actually been done", () => {
    const sets = [set("squat", 0), set("squat", 1, false)];
    expect(bossSets(sets, catalog)).toBe(1); // set index 0 is the last COMPLETED one
  });

  it("is zero when no set belongs to a main compound lift", () => {
    expect(bossSets([set("leg-curl", 0)], catalog)).toBe(0);
  });
});

describe("bossSetExp", () => {
  it("multiplies the base per-set bonus by the given multiplier, rounded", () => {
    expect(bossSetExp(2, 1.5)).toBe(Math.round(2 * BOSS_SET_BASE_EXP * 1.5));
    expect(bossSetExp(1, 2)).toBe(Math.round(BOSS_SET_BASE_EXP * 2));
  });

  it("is zero with zero BOSS sets, regardless of multiplier", () => {
    expect(bossSetExp(0, 2)).toBe(0);
  });
});
