import type { MuscleGroup } from "@/core/training/types";

export type ShadowId =
  | "igris"
  | "tank"
  | "iron"
  | "beru"
  | "greed"
  | "jima"
  | "tusk"
  | "kaisel"
  | "bellion";

export type ShadowDef = {
  readonly id: ShadowId;
  readonly name: string;
  /** Null only for Bellion — it has no lifting muscle group. */
  readonly muscle: MuscleGroup | null;
  readonly startsExtracted: boolean;
};

/**
 * Igris starts already extracted; every other muscle-mapped shadow
 * extracts on its group's first PR, Kaisel on the first logged run,
 * Bellion on reaching S-Rank. None of that triggering logic lives here —
 * this file is only the roster.
 */
export const SHADOW_ROSTER: readonly ShadowDef[] = [
  { id: "igris", name: "Igris", muscle: "chest", startsExtracted: true },
  { id: "tank", name: "Tank", muscle: "back", startsExtracted: false },
  { id: "iron", name: "Iron", muscle: "quads", startsExtracted: false },
  { id: "beru", name: "Beru", muscle: "posterior", startsExtracted: false },
  { id: "greed", name: "Greed", muscle: "shoulders", startsExtracted: false },
  { id: "jima", name: "Jima", muscle: "arms", startsExtracted: false },
  { id: "tusk", name: "Tusk", muscle: "core", startsExtracted: false },
  { id: "kaisel", name: "Kaisel", muscle: "cardio", startsExtracted: false },
  { id: "bellion", name: "Bellion", muscle: null, startsExtracted: false },
] as const;

export function shadowForMuscle(muscle: MuscleGroup): ShadowId {
  const found = SHADOW_ROSTER.find((s) => s.muscle === muscle);
  if (!found) {
    throw new Error(`shadowForMuscle: no shadow mapped to muscle "${muscle}"`);
  }
  return found.id;
}

/**
 * There is no barbell "volume load" for running. This mirrors the existing
 * agilityPerKm constant in core/hunter/stats.ts — the only other place in
 * this codebase that turns a run into a number — so Kaisel's growth has the
 * same shape as every other stat that already depends on distance.
 */
export const CARDIO_EXP_PER_KM = 400;
