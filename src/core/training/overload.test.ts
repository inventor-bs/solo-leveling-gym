import { describe, it, expect } from "vitest";
import { kg, reps } from "@/core/shared/units";
import {
  suggestNextLoad,
  toExercisePerformance,
  AMRAP_TIME_LIMIT_SEC,
  type ExercisePerformance,
  type DungeonType,
} from "./overload";
import type { RepRange, LoggedSet } from "./types";

const RANGE_6_8: RepRange = { min: reps(6), max: reps(8) };

function perf(weight: number, repsPerSet: number[]): ExercisePerformance {
  return { weight: kg(weight), repsPerSet: repsPerSet.map(reps) };
}

describe("suggestNextLoad", () => {
  it("never trained before → starting weight and bottom of range", () => {
    const d = suggestNextLoad([], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("first-time");
    expect(d.targetReps).toBe(6);
    expect(d.weight).toBe(0);
  });

  it("ALL sets hit the top of the range → weight up, reps back to the bottom", () => {
    const d = suggestNextLoad([perf(80, [8, 8, 8, 8])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("increase");
    expect(d.weight).toBe(82.5);
    expect(d.targetReps).toBe(6);
  });

  it("exceeding the top of the range still counts as hitting it", () => {
    const d = suggestNextLoad([perf(80, [9, 8, 8, 8])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("increase");
    expect(d.weight).toBe(82.5);
  });

  it("one set short of the top → hold weight, add 1 rep", () => {
    const d = suggestNextLoad([perf(80, [8, 8, 8, 7])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
    expect(d.targetReps).toBe(8);
  });

  it("hits the bottom but not the top of the range → hold weight", () => {
    const d = suggestNextLoad([perf(80, [6, 6, 6, 6])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
    expect(d.targetReps).toBe(7);
  });

  it("ONE session below the bottom of the range → still hold, no deload yet", () => {
    const d = suggestNextLoad([perf(80, [6, 5, 5, 4])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
  });

  it("TWO consecutive sessions below the bottom → deload 10%", () => {
    const d = suggestNextLoad(
      [perf(80, [5, 5, 4, 4]), perf(80, [6, 5, 5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("deload");
    expect(d.weight).toBe(72);
    expect(d.targetReps).toBe(6);
  });

  it("latest session missed but the one before was fine → no deload yet", () => {
    const d = suggestNextLoad(
      [perf(80, [5, 5, 4, 4]), perf(80, [8, 8, 8, 8])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("hold");
    expect(d.weight).toBe(80);
  });

  it("deload rounds down to the nearest 0.5 kg", () => {
    // 77.5 * 0.9 = 69.75 -> 69.5
    const d = suggestNextLoad(
      [perf(77.5, [5, 4]), perf(77.5, [5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.weight).toBe(69.5);
  });

  it("leg exercises use a 5 kg increment", () => {
    const d = suggestNextLoad([perf(100, [8, 8, 8, 8])], RANGE_6_8, kg(5));
    expect(d.weight).toBe(105);
  });

  it("a session with no completed sets counts as never having trained", () => {
    const d = suggestNextLoad([perf(80, [])], RANGE_6_8, kg(2.5));
    expect(d.action).toBe("first-time");
  });

  it("only the two most recent sessions matter; older ones are ignored", () => {
    const d = suggestNextLoad(
      [perf(80, [8, 8, 8, 8]), perf(80, [5, 4]), perf(80, [5, 4])],
      RANGE_6_8,
      kg(2.5),
    );
    expect(d.action).toBe("increase");
  });
});

describe("suggestNextLoad — dungeon types", () => {
  it("displays a 12-minute AMRAP window and never enforces it", () => {
    // Every number in this app is self-reported; a real countdown would
    // imply an enforcement the data model does not have.
    expect(AMRAP_TIME_LIMIT_SEC).toBe(720);
  });

  it("EMOM is the standard progression, byte for byte", () => {
    const history = [perf(80, [8, 8, 8, 8])];
    expect(suggestNextLoad(history, RANGE_6_8, kg(2.5), "emom")).toEqual(
      suggestNextLoad(history, RANGE_6_8, kg(2.5)),
    );
  });

  it("AMRAP carries the last weight forward instead of progressing it", () => {
    // Standard would have raised this to 82.5 for hitting the top of the range.
    const d = suggestNextLoad(
      [perf(80, [8, 8, 8, 8])],
      RANGE_6_8,
      kg(2.5),
      "amrap",
    );
    expect(d.weight).toBe(80);
    expect(d.action).toBe("amrap");
  });

  it("AMRAP carries the last weight forward instead of deloading it", () => {
    const d = suggestNextLoad(
      [perf(80, [5, 5, 4, 4]), perf(80, [5, 4, 4, 4])],
      RANGE_6_8,
      kg(2.5),
      "amrap",
    );
    expect(d.weight).toBe(80);
    expect(d.action).toBe("amrap");
  });

  it("Drop-set opens at the heaviest weight of the last session", () => {
    const d = suggestNextLoad(
      [perf(80, [8, 6, 4])],
      RANGE_6_8,
      kg(2.5),
      "dropset",
    );
    expect(d.weight).toBe(80);
    expect(d.action).toBe("dropset");
  });

  it("both types still report the bottom of the range as the rep target", () => {
    // targetReps does not apply to either, but the field is not nullable and
    // the bottom of the range is the least misleading thing to prefill.
    for (const type of ["amrap", "dropset"] as const) {
      const d = suggestNextLoad(
        [perf(80, [8, 8, 8])],
        RANGE_6_8,
        kg(2.5),
        type,
      );
      expect(d.targetReps).toBe(RANGE_6_8.min);
    }
  });

  it("falls back to first-time when there is no history to carry forward", () => {
    for (const type of [
      "amrap",
      "dropset",
      "emom",
    ] as const satisfies readonly DungeonType[]) {
      const d = suggestNextLoad([], RANGE_6_8, kg(2.5), type);
      expect(d.action).toBe("first-time");
      expect(d.weight).toBe(0);
    }
  });
});

describe("toExercisePerformance", () => {
  function set(
    exerciseId: string,
    r: number,
    w: number,
    completed = true,
  ): LoggedSet {
    return { exerciseId, setIndex: 0, reps: reps(r), weight: kg(w), completed };
  }

  it("groups sets of one exercise into an ExercisePerformance", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 7, 80), set("squat", 6, 100)],
      "bench",
    );
    expect(p).toEqual({ weight: 80, repsPerSet: [8, 7] });
  });

  it("ignores incomplete sets", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 7, 80, false)],
      "bench",
    );
    expect(p?.repsPerSet).toEqual([8]);
  });

  it("returns null when there are no sets for that exercise", () => {
    expect(toExercisePerformance([set("squat", 6, 100)], "bench")).toBeNull();
  });

  it("uses the heaviest weight when sets used different weights", () => {
    const p = toExercisePerformance(
      [set("bench", 8, 80), set("bench", 6, 85)],
      "bench",
    );
    expect(p?.weight).toBe(85);
  });
});
