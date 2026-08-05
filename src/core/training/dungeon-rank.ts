import { exp, type Exp } from "@/core/shared/units";

/**
 * A session's rank is derived from its planned volume relative to
 * recent average volume. It is never set by hand.
 *
 * Deliberate consequence: as the hunter gets stronger, a session that
 * used to be B-Rank naturally drops to C-Rank — matching how it feels
 * in the source material.
 */
export type DungeonRank = "E" | "D" | "C" | "B" | "A";

export const DUNGEON_RANK_TUNING = {
  thresholds: [
    { rank: "A" as const, minRatio: 1.4 },
    { rank: "B" as const, minRatio: 1.1 },
    { rank: "C" as const, minRatio: 0.8 },
    { rank: "D" as const, minRatio: 0.5 },
    { rank: "E" as const, minRatio: 0 },
  ],
  gold: { E: 30, D: 50, C: 70, B: 95, A: 120 },
  // 5x gold. A level-1 hunter needs 100 EXP to level up, so a single
  // E-rank dungeon very nearly levels them — matches the fast early
  // pacing of the source material. Revisit once real sessions exist.
  exp: { E: 150, D: 250, C: 350, B: 475, A: 600 },
} as const;

export function dungeonRankFor(
  plannedVolume: number,
  avgVolume: number,
): DungeonRank {
  if (avgVolume <= 0) return "C";
  const ratio = plannedVolume / avgVolume;
  for (const t of DUNGEON_RANK_TUNING.thresholds) {
    if (ratio >= t.minRatio) return t.rank;
  }
  return "E";
}

export function goldForDungeonRank(rank: DungeonRank): number {
  return DUNGEON_RANK_TUNING.gold[rank];
}

export function expForDungeonRank(rank: DungeonRank): Exp {
  return exp(DUNGEON_RANK_TUNING.exp[rank]);
}
