import type { SkillId } from "./catalog";
import { WEAKEN_AFTER_DAYS, WEAKEN_RATE_PER_DAY } from "@/core/shadow/grade";
import type { DungeonRank } from "@/core/training/dungeon-rank";

/**
 * Every function here scales a Progression or Adjustment number — EXP,
 * gold, or a fatigue/weaken-rate adjustment — and never a Measured one.
 * Each takes the set of currently EQUIPPED skill ids (never "learned"
 * alone), matching core/title/buffs.ts's rule that only a WORN title does
 * anything. Nothing here can be bought: every skill is paid for in AP,
 * which is itself earned only by leveling and ranking up through training.
 */
type EquippedSkills = ReadonlySet<string>;

const has = (equipped: EquippedSkills, id: SkillId): boolean => equipped.has(id);

/** Tenacity: the Penalty Zone takes 5% of current EXP instead of 10%. */
export function tenacityLossMultiplier(equipped: EquippedSkills): number {
  return has(equipped, "tenacity") ? 0.5 : 1;
}

/** Advanced Regeneration: fatigue decays 25% faster. */
export function fatigueDecayMultiplier(equipped: EquippedSkills): number {
  return has(equipped, "advanced-regeneration") ? 1.25 : 1;
}

/** Iron Body: a shadow starts weakening after 10 inactive days instead of 7. */
export function shadowWeakenAfterDays(equipped: EquippedSkills): number {
  return has(equipped, "iron-body") ? 10 : WEAKEN_AFTER_DAYS;
}

/** Shadow Preservation: a weakening shadow decays 1%/day instead of 2%/day. */
export function shadowWeakenRatePerDay(equipped: EquippedSkills): number {
  return has(equipped, "shadow-preservation") ? 0.01 : WEAKEN_RATE_PER_DAY;
}

/** Army Discipline: Army Rank is the average extracted grade, not the weakest. */
export function armyRankMode(equipped: EquippedSkills): "weakest" | "average" {
  return has(equipped, "army-discipline") ? "average" : "weakest";
}

/** Legion: every shadow gains 10% more EXP. */
export function shadowExpMultiplier(equipped: EquippedSkills): number {
  return has(equipped, "legion") ? 1.1 : 1;
}

const BLOODLUST_GOLD_MULTIPLIER = 1.5;
const BLOODLUST_MIN_RANK: readonly DungeonRank[] = ["B", "A"];

/** Bloodlust: a B-Rank or better dungeon pays 50% more gold. */
export function bloodlustGoldMultiplier(
  equipped: EquippedSkills,
  rank: DungeonRank,
): number {
  if (!has(equipped, "bloodlust")) return 1;
  return BLOODLUST_MIN_RANK.includes(rank) ? BLOODLUST_GOLD_MULTIPLIER : 1;
}

/** The BOSS-set multiplier that applies when Vital Strike is not equipped. */
export const BOSS_SET_DEFAULT_MULTIPLIER = 1.5;
const VITAL_STRIKE_MULTIPLIER = 2;

/** Vital Strike: a BOSS set pays double EXP instead of 1.5x. */
export function vitalStrikeBossMultiplier(equipped: EquippedSkills): number {
  return has(equipped, "vital-strike")
    ? VITAL_STRIKE_MULTIPLIER
    : BOSS_SET_DEFAULT_MULTIPLIER;
}
