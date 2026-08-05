import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import { sessionVolumeLoad, volumeByMuscle, averageVolumeLoad } from "./volume";
import type { LoggedSet, ExerciseDef } from "./types";

function set(
  exerciseId: string,
  r: number,
  w: number,
  completed = true,
): LoggedSet {
  return { exerciseId, setIndex: 0, reps: reps(r), weight: kg(w), completed };
}

const catalog = new Map<string, ExerciseDef>([
  [
    "bench",
    {
      id: "bench",
      name: "Bench Press",
      muscle: "chest",
      kind: "compound",
      isMainLift: true,
      incrementKg: kg(2.5),
    },
  ],
  [
    "squat",
    {
      id: "squat",
      name: "Back Squat",
      muscle: "quads",
      kind: "compound",
      isMainLift: true,
      incrementKg: kg(5),
    },
  ],
]);

describe("sessionVolumeLoad", () => {
  it("sums reps × weight of completed sets", () => {
    // 6*80 + 6*80 = 960
    expect(sessionVolumeLoad([set("bench", 6, 80), set("bench", 6, 80)])).toBe(
      960,
    );
  });

  it("ignores incomplete sets", () => {
    expect(
      sessionVolumeLoad([set("bench", 6, 80), set("bench", 6, 80, false)]),
    ).toBe(480);
  });

  it("returns 0 when there are no sets", () => {
    expect(sessionVolumeLoad([])).toBe(0);
  });

  it("a bodyweight set (0 kg) contributes 0", () => {
    expect(sessionVolumeLoad([set("pushup", 30, 0)])).toBe(0);
  });
});

describe("volumeByMuscle", () => {
  it("groups volume by muscle group", () => {
    const result = volumeByMuscle(
      [set("bench", 6, 80), set("squat", 6, 100)],
      catalog,
    );
    expect(result.chest).toBe(480);
    expect(result.quads).toBe(600);
  });

  it("initializes every muscle group to 0", () => {
    const result = volumeByMuscle([], catalog);
    expect(result.chest).toBe(0);
    expect(result.back).toBe(0);
    expect(result.cardio).toBe(0);
    expect(Object.keys(result)).toHaveLength(8);
  });

  it("ignores an exercise not present in the catalog", () => {
    const result = volumeByMuscle([set("unknown-exercise", 6, 80)], catalog);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });

  it("sums multiple exercises sharing a muscle group", () => {
    const extended = new Map(catalog);
    extended.set("fly", {
      id: "fly",
      name: "Cable Fly",
      muscle: "chest",
      kind: "isolation",
      isMainLift: false,
      incrementKg: kg(2.5),
    });
    const result = volumeByMuscle(
      [set("bench", 6, 80), set("fly", 15, 15)],
      extended,
    );
    expect(result.chest).toBe(480 + 225);
  });
});

describe("averageVolumeLoad", () => {
  it("computes the arithmetic mean", () => {
    expect(averageVolumeLoad([1000, 2000, 3000])).toBe(2000);
  });

  it("returns 0 for an empty array", () => {
    expect(averageVolumeLoad([])).toBe(0);
  });
});
