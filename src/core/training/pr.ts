import { kg, type Kg, type Reps } from "@/core/shared/units";
import type { LoggedSet } from "./types";

/** Epley coefficient. 1RM = w * (1 + reps/30). */
const EPLEY_DIVISOR = 30;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Estimates 1RM using the Epley formula.
 * 1 rep is a special case: exactly that weight, not multiplied.
 */
export function estimateOneRepMax(weight: Kg, repsDone: Reps): Kg {
  if (weight <= 0 || repsDone <= 0) return kg(0);
  if (repsDone === 1) return kg(round1(weight));
  return kg(round1(weight * (1 + repsDone / EPLEY_DIVISOR)));
}

/** Best e1RM among the COMPLETED sets of one exercise. */
export function bestE1rmForExercise(
  sets: readonly LoggedSet[],
  exerciseId: string,
): Kg {
  let best = 0;
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || !s.completed) continue;
    const e1rm = estimateOneRepMax(s.weight, s.reps);
    if (e1rm > best) best = e1rm;
  }
  return kg(best);
}

export type PrResult = {
  readonly exerciseId: string;
  readonly newE1rm: Kg;
  readonly previousE1rm: Kg;
};

/**
 * A PR is an e1RM that EXCEEDS the previous record. Ties don't count.
 *
 * Bodyweight exercises (0 kg) never produce a PR — they belong to the
 * Daily Quest, not the dungeon, and their e1RM is meaningless.
 */
export function detectPrs(
  newSets: readonly LoggedSet[],
  previousBest: ReadonlyMap<string, Kg>,
): PrResult[] {
  const exerciseIds = new Set(
    newSets.filter((s) => s.completed && s.weight > 0).map((s) => s.exerciseId),
  );

  const results: PrResult[] = [];
  for (const exerciseId of exerciseIds) {
    const newE1rm = bestE1rmForExercise(newSets, exerciseId);
    const previousE1rm = previousBest.get(exerciseId) ?? kg(0);
    if (newE1rm > previousE1rm) {
      results.push({ exerciseId, newE1rm, previousE1rm });
    }
  }
  return results;
}
