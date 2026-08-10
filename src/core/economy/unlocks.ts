import { MUSCLE_GROUPS, type MuscleGroup } from "@/core/training/types";
import { SHADOW_GRADE_THRESHOLDS, type ShadowGrade } from "@/core/shadow/grade";
import {
  DUNGEON_TYPE_COST,
  EXERCISE_UNLOCK_COST,
  PROGRAM_531_COST,
  PROGRAM_531_MIN_LEVEL,
  PROGRAM_ARNOLD_COST,
  PROGRAM_ARNOLD_MIN_LEVEL,
  PROGRAM_PPL_COST,
  PROGRAM_PPL_MIN_LEVEL,
} from "./pricing";

export type ProgramUnlockId = "ppl" | "531" | "arnold";
export type DungeonTypeUnlockId = "amrap" | "emom" | "dropset";

/** Every dungeon-type unlock, in the order the Store lists them. */
export const DUNGEON_TYPE_UNLOCK_IDS: readonly DungeonTypeUnlockId[] = [
  "amrap",
  "emom",
  "dropset",
];

export type UnlockRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "level"; readonly minLevel: number }
  | { readonly kind: "army-rank"; readonly minGrade: ShadowGrade };

export type UnlockDef = {
  readonly key: string;
  readonly name: string;
  /** What the Store shows beneath the name, so a locked row explains itself. */
  readonly note: string;
  readonly cost: number;
  readonly requirement: UnlockRequirement;
};

export function programUnlockKey(id: ProgramUnlockId): string {
  return `program:${id}`;
}

export function exerciseUnlockKey(muscle: MuscleGroup): string {
  return `exercise:${muscle}`;
}

export function dungeonTypeUnlockKey(id: DungeonTypeUnlockId): string {
  return `dungeon-type:${id}`;
}

/**
 * Army Rank is a ShadowGrade ladder, not a letter ladder — there is no
 * "D-Rank" army to gate on. The letters map onto the grades in order, so
 * the exercise unlock's "D or better" means Elite or better: the tier
 * directly above the one every army starts at.
 */
const EXERCISE_UNLOCK_MIN_GRADE: ShadowGrade = "Elite";

/**
 * Buying a program or an exercise unlock creates NO program_day and NO
 * exercise row. Choosing what to actually train is the hunter's decision,
 * made when they are ready to switch — the purchase records the right, and
 * the content is authored later.
 */
export const UNLOCK_CATALOG: readonly UnlockDef[] = [
  {
    key: programUnlockKey("ppl"),
    name: "Push / Pull / Legs — 6 days",
    note: "Unlocked. Content will be added when you are ready to switch programs.",
    cost: PROGRAM_PPL_COST,
    requirement: { kind: "level", minLevel: PROGRAM_PPL_MIN_LEVEL },
  },
  {
    key: programUnlockKey("531"),
    name: "5/3/1",
    note: "Unlocked. Content will be added when you are ready to switch programs.",
    cost: PROGRAM_531_COST,
    requirement: { kind: "level", minLevel: PROGRAM_531_MIN_LEVEL },
  },
  {
    key: programUnlockKey("arnold"),
    name: "Arnold Split",
    note: "Unlocked. Content will be added when you are ready to switch programs.",
    cost: PROGRAM_ARNOLD_COST,
    requirement: { kind: "level", minLevel: PROGRAM_ARNOLD_MIN_LEVEL },
  },
  ...MUSCLE_GROUPS.map((muscle) => ({
    key: exerciseUnlockKey(muscle),
    name: `New exercise — ${muscle}`,
    note: "Unlocked. Pick the exercise when you next revise the program.",
    cost: EXERCISE_UNLOCK_COST,
    requirement: {
      kind: "army-rank" as const,
      minGrade: EXERCISE_UNLOCK_MIN_GRADE,
    },
  })),
  {
    key: dungeonTypeUnlockKey("amrap"),
    name: "AMRAP dungeons",
    note: "Carry the load forward and take as many reps as the clock allows.",
    cost: DUNGEON_TYPE_COST,
    requirement: { kind: "none" },
  },
  {
    key: dungeonTypeUnlockKey("emom"),
    name: "EMOM dungeons",
    note: "The standard load, one set on the minute.",
    cost: DUNGEON_TYPE_COST,
    requirement: { kind: "none" },
  },
  {
    key: dungeonTypeUnlockKey("dropset"),
    name: "Drop-set dungeons",
    note: "Open at your working weight and strip it down set by set.",
    cost: DUNGEON_TYPE_COST,
    requirement: { kind: "none" },
  },
] as const;

export function unlockByKey(key: string): UnlockDef | null {
  return UNLOCK_CATALOG.find((u) => u.key === key) ?? null;
}

/**
 * Grades are compared by their EXP threshold rather than by array index, so
 * the ladder has exactly one definition and reordering the threshold table
 * cannot silently reorder these gates.
 */
function minExpOf(grade: ShadowGrade): number {
  return SHADOW_GRADE_THRESHOLDS.find((t) => t.grade === grade)?.minExp ?? 0;
}

export function meetsRequirement(
  requirement: UnlockRequirement,
  context: { level: number; armyRank: ShadowGrade | null },
): boolean {
  switch (requirement.kind) {
    case "none":
      return true;
    case "level":
      return context.level >= requirement.minLevel;
    case "army-rank":
      if (context.armyRank === null) return false;
      return minExpOf(context.armyRank) >= minExpOf(requirement.minGrade);
  }
}
