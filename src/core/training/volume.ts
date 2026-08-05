import type { LoggedSet, ExerciseDef, MuscleGroup } from "./types";
import { MUSCLE_GROUPS } from "./types";

/**
 * Volume load = Σ (reps × kg) over COMPLETED sets.
 * This is the unit of mechanical work, and it feeds the VIT stat,
 * shadow EXP, and dungeon rank.
 */
export function sessionVolumeLoad(sets: readonly LoggedSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (!s.completed) continue;
    total += s.reps * s.weight;
  }
  return total;
}

/** Volume split by muscle group. Every group is always present, defaulting to 0. */
export function volumeByMuscle(
  sets: readonly LoggedSet[],
  catalog: ReadonlyMap<string, ExerciseDef>,
): Record<MuscleGroup, number> {
  const result = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;

  for (const s of sets) {
    if (!s.completed) continue;
    const def = catalog.get(s.exerciseId);
    if (!def) continue;
    result[def.muscle] += s.reps * s.weight;
  }
  return result;
}

export function averageVolumeLoad(sessionVolumes: readonly number[]): number {
  if (sessionVolumes.length === 0) return 0;
  return sessionVolumes.reduce((a, b) => a + b, 0) / sessionVolumes.length;
}
