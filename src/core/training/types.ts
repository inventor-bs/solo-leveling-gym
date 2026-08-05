import type { Kg, Reps, Epoch } from "@/core/shared/units";
import type { TrainingDay } from "@/core/shared/training-day";

/**
 * Eight muscle groups, mapped 1-1 to the eight shadow soldiers.
 * "posterior" = posterior chain (glutes/hamstrings) — Beru's group.
 */
export type MuscleGroup =
  | "chest"
  | "back"
  | "quads"
  | "posterior"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio";

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "chest",
  "back",
  "quads",
  "posterior",
  "shoulders",
  "arms",
  "core",
  "cardio",
] as const;

export type ExerciseKind = "compound" | "isolation";

export type RepRange = { readonly min: Reps; readonly max: Reps };

export interface ExerciseDef {
  readonly id: string;
  readonly name: string;
  readonly muscle: MuscleGroup;
  readonly kind: ExerciseKind;
  /** One of the 5 main lifts feeding STR: bench, squat, deadlift, OHP, row. */
  readonly isMainLift: boolean;
  /** Weight increment applied on reaching the top of the rep range. */
  readonly incrementKg: Kg;
}

export interface LoggedSet {
  readonly exerciseId: string;
  readonly setIndex: number;
  readonly reps: Reps;
  readonly weight: Kg;
  readonly completed: boolean;
}

export interface SessionRecord {
  readonly id: string;
  readonly day: TrainingDay;
  readonly programDayId: string;
  readonly startedAt: Epoch;
  readonly endedAt: Epoch | null;
  readonly sets: readonly LoggedSet[];
}

export interface RunRecord {
  readonly day: TrainingDay;
  readonly distanceKm: number;
  readonly durationSec: number;
}
