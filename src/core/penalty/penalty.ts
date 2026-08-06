import type { QuestTargets } from "@/core/quest/daily-quest";
import type { Stats } from "@/core/hunter/stats";

export const EXP_LOSS_RATE = 0.1;
export const STAT_PENALTY_RATE = 0.15;
export const SURVIVAL_BASE_TENTHS = 15;
export const SURVIVAL_MAX_TENTHS = 20;
export const SYSTEM_SILENCE_DAY = 7;

/**
 * The permanent half of the punishment.
 *
 * Takes and returns only the within-level EXP pool. There is deliberately
 * no level parameter: a function that cannot see the level cannot lower it,
 * which is a stronger guarantee than a branch that promises not to.
 */
export function expAfterPenalty(currentExp: number): number {
  return Math.max(0, Math.floor(currentExp * (1 - EXP_LOSS_RATE)));
}

/**
 * 1.5x on the first day stuck, +0.1 per further day, hard capped at 2x.
 *
 * Computed in integer tenths on purpose: 1.5 + 3 * 0.1 evaluates to
 * 1.8000000000000003, and that drift survives the Math.ceil() below as a
 * rep the hunter never actually owed.
 */
export function survivalMultiplier(daysStuck: number): number {
  const days = Math.max(0, Math.floor(daysStuck));
  const tenths = Math.min(SURVIVAL_BASE_TENTHS + days, SURVIVAL_MAX_TENTHS);
  return tenths / 10;
}

export function survivalTargets(
  daily: QuestTargets,
  daysStuck: number,
): QuestTargets {
  const m = survivalMultiplier(daysStuck);
  return {
    // Reps round up: a rounding rule that shaves the target would make the
    // escape quietly easier than stated.
    pushups: Math.ceil(daily.pushups * m),
    situps: Math.ceil(daily.situps * m),
    squats: Math.ceil(daily.squats * m),
    runKm: Math.round(daily.runKm * m * 10) / 10,
  };
}

/** Past this point the System stops speaking rather than escalating further. */
export function isSystemSilent(daysStuck: number): boolean {
  return daysStuck >= SYSTEM_SILENCE_DAY;
}

/**
 * An Adjustment, applied when stats are read. The caller must never write
 * the result back to the hunter's stat columns — the stored value is the
 * measured one and has to survive the penalty untouched.
 */
export function applyPenaltyToStats(
  stats: Stats,
  penaltyActive: boolean,
): Stats {
  if (!penaltyActive) return stats;
  const keep = 1 - STAT_PENALTY_RATE;
  return {
    strength: Math.floor(stats.strength * keep),
    agility: Math.floor(stats.agility * keep),
    vitality: Math.floor(stats.vitality * keep),
    intelligence: Math.floor(stats.intelligence * keep),
    perception: Math.floor(stats.perception * keep),
    luck: Math.floor(stats.luck * keep),
  };
}
