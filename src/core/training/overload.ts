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

export type OverloadAction = "increase" | "hold" | "deload" | "first-time";

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
 */
export function suggestNextLoad(
  history: readonly ExercisePerformance[],
  range: RepRange,
  incrementKg: Kg,
): OverloadDecision {
  const last = history[0];
  const previous = history[1];

  if (!hasCompletedSets(last)) {
    return { weight: kg(0), targetReps: range.min, action: "first-time" };
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
