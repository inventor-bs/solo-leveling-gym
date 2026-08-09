import {
  WAGER_MAX_STAKE_FRACTION,
  WAGER_PAYOUT_MULTIPLIER,
  WAGER_TARGET_DUNGEONS,
  WAGER_TARGET_RUNS,
  WAGER_TARGET_QUESTS,
} from "./pricing";

/** What the week actually contained, counted from stored rows. */
export type WagerContract = {
  readonly dungeonsCleared: number;
  readonly runsLogged: number;
  readonly dailyQuestsCompleted: number;
};

/**
 * The most gold that may be staked on one week.
 *
 * Half, so a lost wager is always survivable — the mechanic is meant to
 * raise the stakes on a week of training, not to be able to erase an
 * economy the hunter spent months building.
 */
export function maxStake(currentGold: number): number {
  return Math.max(0, Math.floor(currentGold * WAGER_MAX_STAKE_FRACTION));
}

export function isStakeAllowed(stake: number, currentGold: number): boolean {
  if (!Number.isInteger(stake)) return false;
  if (stake <= 0) return false;
  return stake <= maxStake(currentGold);
}

/** All three, or the week is lost. The contract is fixed and not negotiable. */
export function wagerWon(actual: WagerContract): boolean {
  return (
    actual.dungeonsCleared >= WAGER_TARGET_DUNGEONS &&
    actual.runsLogged >= WAGER_TARGET_RUNS &&
    actual.dailyQuestsCompleted >= WAGER_TARGET_QUESTS
  );
}

/**
 * What a win credits. The stake was taken at placement, so this is the
 * gross amount returned — a net gain of twice the stake.
 */
export function wagerPayout(stakeGold: number): number {
  return stakeGold * WAGER_PAYOUT_MULTIPLIER;
}
