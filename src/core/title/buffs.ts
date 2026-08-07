import type { TitleId } from "./catalog";

/**
 * Every multiplier here scales a PROGRESSION number — EXP or gold — and
 * never a measured one. That is the line this project holds: e1RM, volume,
 * PRs and the six stats take no modifier at all, while EXP and gold may be
 * scaled by something the hunter earned through training. A title is earned
 * by streaks, dawn sessions or escapes; there is no way to buy one, so
 * these functions cannot become a shop.
 *
 * Each takes the currently EQUIPPED title, because only one is worn at a
 * time — an unequipped title, however hard it was earned, does nothing.
 */

/** Unyielding: the Penalty Zone takes 20% less of what it would have taken. */
export const PENALTY_EXP_LOSS_MULTIPLIER = 0.8;
/** Monarch of Dawn: sessions started before the morning cutoff pay 15% more gold. */
export const MORNING_GOLD_MULTIPLIER = 1.15;
/** One Who Returned: the first session after an escape pays 10% more EXP. */
export const RETURN_EXP_MULTIPLIER = 1.1;

export function penaltyExpLossMultiplier(equipped: TitleId | null): number {
  return equipped === "unyielding" ? PENALTY_EXP_LOSS_MULTIPLIER : 1;
}

export function sessionGoldMultiplier(
  equipped: TitleId | null,
  startedBeforeMorningCutoff: boolean,
): number {
  return equipped === "monarch-of-dawn" && startedBeforeMorningCutoff
    ? MORNING_GOLD_MULTIPLIER
    : 1;
}

export function sessionExpMultiplier(
  equipped: TitleId | null,
  isFirstSessionAfterPenaltyExit: boolean,
): number {
  return equipped === "one-who-returned" && isFirstSessionAfterPenaltyExit
    ? RETURN_EXP_MULTIPLIER
    : 1;
}
