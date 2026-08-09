import { gold as makeGold, type Gold } from "@/core/shared/units";
import { PR_GOLD, LEVEL_UP_GOLD_PER_LEVEL } from "./pricing";

/**
 * Gold for the PRs a session produced.
 *
 * `goldPerPr` is a rate, not a buff: it exists so a cleared Boss Raid can
 * pay its higher per-PR rate without a second function, and it is only ever
 * given a value from the pricing table. It does not touch PR DETECTION,
 * which stays a measured number computed by detectPrs with no parameters
 * beyond the sets and the previous bests.
 */
export function goldForPrs(prCount: number, goldPerPr: number = PR_GOLD): Gold {
  if (prCount <= 0) return makeGold(0);
  return makeGold(Math.floor(prCount) * goldPerPr);
}

/**
 * Gold for every level crossed by one award of EXP.
 *
 * Paid per level, not per level-UP: a session that carries the hunter from
 * 20 to 22 pays for level 21 and level 22 both. Paying once would quietly
 * punish the single best session someone ever has.
 */
export function goldForLevelUps(fromLevel: number, toLevel: number): Gold {
  let total = 0;
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    total += LEVEL_UP_GOLD_PER_LEVEL * level;
  }
  return makeGold(Math.max(0, total));
}
