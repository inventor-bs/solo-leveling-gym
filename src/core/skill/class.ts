import type { Stats } from "@/core/hunter/stats";
import type { ShadowGrade } from "@/core/shadow/grade";

export type ClassId =
  "berserker" | "assassin" | "tanker" | "fighter" | "shadow-monarch";

export type ClassDef = {
  readonly id: ClassId;
  readonly name: string;
  readonly condition: string;
  readonly privilege: string;
  /** Shadow Monarch never appears in a locked-and-visible state — the UI must hide it, not grey it out. */
  readonly hiddenUntilEligible: boolean;
};

export const CLASS_CATALOG: readonly ClassDef[] = [
  {
    id: "berserker",
    name: "Berserker",
    condition: "STR clearly the dominant stat",
    privilege: "+25% EXP on compound lifts, 5/3/1 unlocked free",
    hiddenUntilEligible: false,
  },
  {
    id: "assassin",
    name: "Assassin",
    condition: "AGI clearly the dominant stat",
    privilege: "Fatigue recovers 40% faster, runs pay double gold",
    hiddenUntilEligible: false,
  },
  {
    id: "tanker",
    name: "Tanker",
    condition: "VIT clearly the dominant stat",
    privilege: "Fatigue ceiling +25, softened penalty",
    hiddenUntilEligible: false,
  },
  {
    id: "fighter",
    name: "Fighter",
    condition: "STR/AGI/VIT roughly balanced",
    privilege: "+10% to everything, one more skill slot",
    hiddenUntilEligible: false,
  },
  {
    id: "shadow-monarch",
    name: "Shadow Monarch",
    condition: "All 8 muscle-mapped shadows reach Knight or better",
    privilege:
      "Bellion awakens fully, SOVEREIGN branch costs half AP, Monarch theme",
    hiddenUntilEligible: true,
  },
] as const;

/**
 * A stat "clearly dominates" when it beats the average of the other two
 * combat stats by this margin. Provisional, like every other threshold in
 * this codebase tuned before real usage data exists — revisit once real
 * Job Change attempts happen.
 */
const DOMINANCE_MARGIN = 1.15;

export function determineClass(stats: Stats): ClassId {
  const { strength, agility, vitality } = stats;
  const candidates: { id: ClassId; value: number; others: number }[] = [
    { id: "berserker", value: strength, others: (agility + vitality) / 2 },
    { id: "assassin", value: agility, others: (strength + vitality) / 2 },
    { id: "tanker", value: vitality, others: (strength + agility) / 2 },
  ];

  const dominant = candidates
    .filter((c) => c.others > 0 && c.value >= c.others * DOMINANCE_MARGIN)
    .sort((a, b) => b.value - a.value)[0];

  return dominant?.id ?? "fighter";
}

const SECOND_AWAKENING_MIN_GRADE_RANK: Record<ShadowGrade, number> = {
  Normal: 1,
  Elite: 2,
  Knight: 3,
  Marshal: 4,
  Commander: 5,
  "Grand Marshal": 6,
};

/**
 * All 8 muscle-mapped shadows (never Bellion — it has no grade ladder), at
 * Knight or better. The threshold is a constant deliberately isolated here
 * since it will need tuning once real training data exists.
 */
export function secondAwakeningEligible(
  muscleShadowGrades: readonly ShadowGrade[],
): boolean {
  if (muscleShadowGrades.length < 8) return false;
  return muscleShadowGrades.every(
    (g) =>
      SECOND_AWAKENING_MIN_GRADE_RANK[g] >=
      SECOND_AWAKENING_MIN_GRADE_RANK.Knight,
  );
}
