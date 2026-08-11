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

export type ArmyRankMode = "weakest" | "average";

const GRADE_BY_RANK: Record<number, ShadowGrade> = Object.fromEntries(
  Object.entries(GRADE_RANK).map(([grade, rank]) => [
    rank,
    grade as ShadowGrade,
  ]),
);

/**
 * Weakest-link by default — balance across the army is the mechanically
 * optimal path. An "average" mode exists as an alternative gated behind the
 * same `extracted && countsTowardArmy` filter.
 */
export function armyRank(
  standings: readonly ShadowStanding[],
  mode: ArmyRankMode = "weakest",
): ShadowGrade | null {
  const eligible = standings.filter((s) => s.extracted && s.countsTowardArmy);
  if (eligible.length === 0) return null;

  if (mode === "weakest") {
    return eligible.reduce((weakest, s) =>
      GRADE_RANK[s.grade] < GRADE_RANK[weakest.grade] ? s : weakest,
    ).grade;
  }

  const meanRank =
    eligible.reduce((sum, s) => sum + GRADE_RANK[s.grade], 0) / eligible.length;
  const rounded = Math.min(
    Math.max(Math.round(meanRank), 1),
    Object.keys(GRADE_BY_RANK).length,
  );
  return GRADE_BY_RANK[rounded]!;
}
