import { RANK_THRESHOLDS, type Rank } from "@/core/hunter/progression";
import {
  NARRATIVE_FRAGMENTS,
  type ArcStage,
  type NarrativeFragment,
} from "./fragments";

/**
 * Everything a milestone can be gated on. All three are derived from real
 * activity: the day count from the clock and the hunter's creation instant,
 * level and rank from logged training.
 */
export type NarrativeProgress = {
  readonly daysSinceStart: number;
  readonly level: number;
  readonly rank: Rank;
};

/**
 * Ranks are compared through their own level thresholds rather than a
 * second hand-written ordering, so there is exactly one place that decides
 * a rank is "higher" than another.
 */
function minLevelFor(rank: Rank): number {
  return RANK_THRESHOLDS.find((t) => t.rank === rank)?.minLevel ?? 0;
}

export function milestoneMet(
  fragment: NarrativeFragment,
  progress: NarrativeProgress,
): boolean {
  const m = fragment.milestone;
  switch (m.kind) {
    case "day":
      return progress.daysSinceStart >= m.days;
    case "level":
      return progress.level >= m.level;
    case "rank":
      return minLevelFor(progress.rank) >= minLevelFor(m.rank);
  }
}

/**
 * The single fragment that may be unlocked right now, or null.
 *
 * Strictly ordered: the walk stops at the first fragment that has not been
 * read, and unlocks it only if its own milestone is met. A later fragment
 * whose gate happens to open earlier waits. The gates run on three axes
 * that advance at rates set entirely by how the hunter trains, so without
 * this rule a fast climber would meet the Architect before learning the
 * System has a maker — and a story told out of order is not a story.
 *
 * Returning ONE fragment rather than a list is what lets the caller enforce
 * "at most one per day": the ordering rule builds a backlog, and dumping
 * three beats of a fifteen-beat arc onto one screen spends them for nothing.
 */
export function nextFragmentToUnlock(
  unlockedIds: readonly string[],
  progress: NarrativeProgress,
): NarrativeFragment | null {
  const unlocked = new Set(unlockedIds);
  for (const fragment of NARRATIVE_FRAGMENTS) {
    if (unlocked.has(fragment.id)) continue;
    return milestoneMet(fragment, progress) ? fragment : null;
  }
  return null;
}

/** The stage of the furthest fragment read. Derived, never stored. */
export function arcStageFor(unlockedIds: readonly string[]): ArcStage {
  const unlocked = new Set(unlockedIds);
  let stage: ArcStage = "dormant";
  for (const fragment of NARRATIVE_FRAGMENTS) {
    if (unlocked.has(fragment.id)) stage = fragment.stage;
  }
  return stage;
}

/** How much of the arc is still sealed. */
export function sealedCount(unlockedIds: readonly string[]): number {
  const unlocked = new Set(unlockedIds);
  return NARRATIVE_FRAGMENTS.filter((f) => !unlocked.has(f.id)).length;
}
