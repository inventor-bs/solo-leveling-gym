import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import { estimateOneRepMax, bestE1rmForExercise, detectPrs } from "./pr";
import type { LoggedSet } from "./types";

function set(
  exerciseId: string,
  setIndex: number,
  r: number,
  w: number,
  completed = true,
): LoggedSet {
  return { exerciseId, setIndex, reps: reps(r), weight: kg(w), completed };
}

describe("estimateOneRepMax", () => {
  it("1 rep returns that exact weight", () => {
    expect(estimateOneRepMax(kg(100), reps(1))).toBe(100);
  });

  it("applies the Epley formula for multiple reps", () => {
    // 100 * (1 + 6/30) = 120
    expect(estimateOneRepMax(kg(100), reps(6))).toBe(120);
  });

  it("rounds to 0.1 kg", () => {
    // 82.5 * (1 + 7/30) = 101.75 -> 101.8
    expect(estimateOneRepMax(kg(82.5), reps(7))).toBe(101.8);
  });

  it("0 reps returns 0", () => {
    expect(estimateOneRepMax(kg(100), reps(0))).toBe(0);
  });

  it("0 kg (bodyweight exercise) returns 0", () => {
    expect(estimateOneRepMax(kg(0), reps(20))).toBe(0);
  });
});

describe("bestE1rmForExercise", () => {
  it("takes the highest e1RM among that exercise's sets", () => {
    const sets = [
      set("bench", 0, 8, 70), // 70 * 1.2667 = 88.7
      set("bench", 1, 6, 80), // 80 * 1.2 = 96
      set("bench", 2, 5, 80), // 80 * 1.1667 = 93.3
    ];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("ignores incomplete sets", () => {
    const sets = [set("bench", 0, 6, 80), set("bench", 1, 10, 100, false)];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("ignores sets of a different exercise", () => {
    const sets = [set("bench", 0, 6, 80), set("squat", 1, 6, 120)];
    expect(bestE1rmForExercise(sets, "bench")).toBe(96);
  });

  it("returns 0 when no sets exist for that exercise", () => {
    expect(bestE1rmForExercise([set("squat", 0, 6, 120)], "bench")).toBe(0);
  });
});

describe("detectPrs", () => {
  it("reports a PR when the new e1RM beats the old record", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80)],
      new Map([["bench", kg(90)]]),
    );
    expect(prs).toEqual([
      { exerciseId: "bench", newE1rm: 96, previousE1rm: 90 },
    ]);
  });

  it("does NOT report a PR when tying the old record", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80)],
      new Map([["bench", kg(96)]]),
    );
    expect(prs).toEqual([]);
  });

  it("does NOT report a PR when below the old record", () => {
    const prs = detectPrs(
      [set("bench", 0, 5, 70)],
      new Map([["bench", kg(96)]]),
    );
    expect(prs).toEqual([]);
  });

  it("a first-ever attempt at an exercise counts as a PR", () => {
    const prs = detectPrs([set("squat", 0, 6, 100)], new Map());
    expect(prs).toEqual([
      { exerciseId: "squat", newE1rm: 120, previousE1rm: 0 },
    ]);
  });

  it("reports multiple PRs within the same session", () => {
    const prs = detectPrs(
      [set("bench", 0, 6, 80), set("row", 0, 6, 70)],
      new Map([["bench", kg(90)]]),
    );
    expect(prs).toHaveLength(2);
    expect(prs.map((p) => p.exerciseId).sort()).toEqual(["bench", "row"]);
  });

  it("ignores bodyweight exercises (0 kg) — no fake PRs", () => {
    expect(detectPrs([set("pushup", 0, 30, 0)], new Map())).toEqual([]);
  });
});
