import { SHADOW_GRADE_THRESHOLDS, type ShadowGrade } from "./grade";

export type ShadowStanding = {
  readonly grade: ShadowGrade;
  readonly extracted: boolean;
  /** False for Bellion — it has no grade ladder and does not gate the army. */
  readonly countsTowardArmy: boolean;
};

const GRADE_RANK: Record<ShadowGrade, number> = Object.fromEntries(
  // Lower index in the descending threshold table = higher grade, so this
  // inverts it: a bigger number here means a stronger shadow.
  SHADOW_GRADE_THRESHOLDS.map((t, i) => [
    t.grade,
    SHADOW_GRADE_THRESHOLDS.length - i,
  ]),
) as Record<ShadowGrade, number>;

/** Weakest-link, not an average — the spec's whole point is that balance is optimal. */
export function armyRank(
  standings: readonly ShadowStanding[],
): ShadowGrade | null {
  const eligible = standings.filter((s) => s.extracted && s.countsTowardArmy);
  if (eligible.length === 0) return null;

  return eligible.reduce((weakest, s) =>
    GRADE_RANK[s.grade] < GRADE_RANK[weakest.grade] ? s : weakest,
  ).grade;
}
