import type { LoggedSet } from "./types";

/**
 * The flat EXP one BOSS set contributes before any multiplier. Additive to
 * session EXP: there is no true per-set EXP model in this codebase (session
 * EXP is a flat per-session amount keyed off dungeon rank), so this is a
 * new, small, additive bonus rather than a rescaling of that number.
 */
export const BOSS_SET_BASE_EXP = 15;

type ExerciseInfo = { isMainLift: boolean; kind: "compound" | "isolation" };

/**
 * The BOSS set is the highest-indexed COMPLETED set of each exercise that
 * is both a main lift and a compound movement — the last set of the
 * session's main compound lift. One session can carry more than one
 * qualifying exercise (e.g. squat AND bench on the same day), and each
 * contributes exactly one BOSS set.
 */
export function bossSets(
  sets: readonly LoggedSet[],
  catalog: ReadonlyMap<string, ExerciseInfo>,
): number {
  const lastCompletedIndexByExercise = new Map<string, number>();
  for (const s of sets) {
    if (!s.completed) continue;
    const info = catalog.get(s.exerciseId);
    if (!info || !info.isMainLift || info.kind !== "compound") continue;
    const current = lastCompletedIndexByExercise.get(s.exerciseId) ?? -1;
    if (s.setIndex > current) {
      lastCompletedIndexByExercise.set(s.exerciseId, s.setIndex);
    }
  }
  return lastCompletedIndexByExercise.size;
}

/** The session's total BOSS-set EXP bonus: a flat per-set amount, scaled by the given multiplier and rounded to a whole EXP value. */
export function bossSetExp(count: number, multiplier: number): number {
  if (count <= 0) return 0;
  return Math.round(count * BOSS_SET_BASE_EXP * multiplier);
}
