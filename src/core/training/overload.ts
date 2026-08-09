import { kg, reps as makeReps, type Kg, type Reps } from "@/core/shared/units";
import type { RepRange, LoggedSet } from "./types";

/** Balance constants. Tune here, not scattered through the logic. */
export const DELOAD_FACTOR = 0.9;
export const DELOAD_AFTER_CONSECUTIVE_FAILURES = 2;
export const WEIGHT_ROUNDING_KG = 0.5;

export type ExercisePerformance = {
  readonly weight: Kg;
  readonly repsPerSet: readonly Reps[];
};

/**
 * How a session's sets are structured. This shapes the SUGGESTION only —
 * volume, e1RM, PR detection and dungeon rank all read the raw logged sets
 * and are identical whichever type was chosen, which is why nothing about
 * the choice is ever persisted.
 */
export type DungeonType = "standard" | "amrap" | "emom" | "dropset";

/**
 * The AMRAP window, in seconds. Displayed next to the exercise and never
 * enforced: everything in this app is self-reported, and a real countdown
 * would promise a rigour the data does not have.
 */
export const AMRAP_TIME_LIMIT_SEC = 720;

export type OverloadAction =
  "increase" | "hold" | "deload" | "first-time" | "amrap" | "dropset";

export type OverloadDecision = {
  readonly weight: Kg;
  readonly targetReps: Reps;
  readonly action: OverloadAction;
};

function roundDownTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function hasCompletedSets(
  p: ExercisePerformance | undefined,
): p is ExercisePerformance {
  return !!p && p.repsPerSet.length > 0;
}

function allSetsReachedMax(p: ExercisePerformance, range: RepRange): boolean {
  return p.repsPerSet.every((r) => r >= range.max);
}

function anySetBelowMin(p: ExercisePerformance, range: RepRange): boolean {
  return p.repsPerSet.some((r) => r < range.min);
}

/**
 * Double progression:
 *   • ALL sets hit the top of the range   → weight up, reps back to the bottom
 *   • Not all sets hit the top yet        → hold weight, aim for 1 more rep
 *   • 2 CONSECUTIVE sessions below the bottom of the range → deload 10%
 *
 * `history` is sorted MOST RECENT FIRST. Only its first two entries matter.
 *
 * AMRAP and Drop-set opt out of rep-range progression entirely and simply
 * carry the last weight forward: in an AMRAP the rep count is the whole
 * point and a rep range would contradict it, and in a Drop-set the load
 * falls deliberately from set to set, so comparing any set against a range
 * would read every session as a failure. EMOM passes straight through —
 * mechanically it IS the standard progression, with a clock the app does
 * not run.
 *
 * `dungeonType` shapes a suggestion, not a measurement. Nothing downstream
 * of this function — volume, e1RM, PR detection, dungeon rank — can see it.
 */
export function suggestNextLoad(
  history: readonly ExercisePerformance[],
  range: RepRange,
  incrementKg: Kg,
  dungeonType: DungeonType = "standard",
): OverloadDecision {
  const last = history[0];
  const previous = history[1];

  if (!hasCompletedSets(last)) {
    return { weight: kg(0), targetReps: range.min, action: "first-time" };
  }

  // Both read `last.weight`, which toExercisePerformance sets to the
  // HEAVIEST weight of the session — for a drop set that is the opening
  // weight, which is exactly the one to suggest starting from again.
  if (dungeonType === "amrap") {
    return { weight: last.weight, targetReps: range.min, action: "amrap" };
  }
  if (dungeonType === "dropset") {
    return { weight: last.weight, targetReps: range.min, action: "dropset" };
  }

  const lastFailed = anySetBelowMin(last, range);
  const previousFailed = hasCompletedSets(previous)
    ? anySetBelowMin(previous, range)
    : false;

  if (lastFailed && previousFailed && DELOAD_AFTER_CONSECUTIVE_FAILURES === 2) {
    return {
      weight: kg(roundDownTo(last.weight * DELOAD_FACTOR, WEIGHT_ROUNDING_KG)),
      targetReps: range.min,
      action: "deload",
    };
  }

  if (allSetsReachedMax(last, range)) {
    return {
      weight: kg(last.weight + incrementKg),
      targetReps: range.min,
      action: "increase",
    };
  }

  const worstSet = Math.min(...last.repsPerSet);
  const nextTarget = Math.min(Math.max(worstSet + 1, range.min), range.max);
  return {
    weight: last.weight,
    targetReps: makeReps(nextTarget),
    action: "hold",
  };
}

/**
 * Groups the completed sets of one exercise into an ExercisePerformance.
 * The weight taken is the heaviest one used — if a session mixed weights,
 * the heaviest is the one that reflects progress.
 */
export function toExercisePerformance(
  sets: readonly LoggedSet[],
  exerciseId: string,
): ExercisePerformance | null {
  const relevant = sets.filter(
    (s) => s.exerciseId === exerciseId && s.completed,
  );
  if (relevant.length === 0) return null;

  return {
    weight: kg(Math.max(...relevant.map((s) => s.weight))),
    repsPerSet: relevant.map((s) => s.reps),
  };
}
