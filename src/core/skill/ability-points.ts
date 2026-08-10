import { RANK_THRESHOLDS, type Rank } from "@/core/hunter/progression";

export const AP_PER_LEVEL = 1;
export const AP_PER_RANK_UP = 5;

/**
 * Total AP the hunter has ever earned, derived purely from level and rank —
 * both already-stored Progression numbers — rather than stored itself.
 * Nothing here can be bought: leveling and ranking up both come only from
 * EXP, which itself comes only from training.
 *
 * `rank` is passed rather than recomputed via `rankForLevel(level)` so a
 * caller that already has the hunter row does not do the lookup twice, and
 * so this function has no way to disagree with the stored rank if the two
 * ever needed to diverge for a migration edge case.
 */
export function apEarnedForLevel(level: number, _rank: Rank): number {
  const levelAp = Math.max(0, Math.floor(level) - 1) * AP_PER_LEVEL;

  const ranksCrossed = RANK_THRESHOLDS.filter(
    (t) => t.rank !== "E" && t.minLevel <= level,
  ).length;

  return levelAp + ranksCrossed * AP_PER_RANK_UP;
}
