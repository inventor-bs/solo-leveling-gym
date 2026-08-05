/**
 * A session's rank is derived from its planned volume relative to
 * recent average volume (spec §5.6). It is never set by hand.
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
