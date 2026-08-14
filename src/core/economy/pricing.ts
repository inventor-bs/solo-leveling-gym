import type { DungeonRank } from "@/core/training/dungeon-rank";

/**
 * Every price, rate and threshold in the economy, in one file.
 *
 * None of these numbers has been validated against real play — there is not
 * yet enough history to validate them with. They were approved on paper and
 * will need tuning. Keeping all of them here means tuning is a one-file
 * change instead of a hunt through app-services, and it makes the whole
 * economy auditable at a glance.
 *
 * This module imports nothing from its siblings on purpose: it is the leaf
 * every other economy module reads from, so there is no way to create a
 * cycle by adding a constant.
 */

// ---------------------------------------------------------------- income

/** Paid once per PR in the array detectPrs() returns, so three PRs pay three times. */
export const PR_GOLD = 150;

/**
 * Multiplied by the NEW level, and summed across every level a single
 * session crosses: 20 -> 21 pays 2,100, and 20 -> 22 pays 2,100 + 2,200.
 */
export const LEVEL_UP_GOLD_PER_LEVEL = 100;

/** A week with every scheduled session trained, every quest cleared, no penalty. */
export const PERFECT_WEEK_GOLD = 500;

// ------------------------------------------------------- harder content

export const INSTANT_DUNGEON_KEY_COST = 800;

export const RED_GATE_COST = 2_500;
/** Planned volume must reach this multiple of the recent average to clear. */
export const RED_GATE_VOLUME_RATIO = 1.5;
/** Applied to both gold and EXP on a cleared Red Gate. */
export const RED_GATE_REWARD_MULTIPLIER = 4;

export const BOSS_RAID_COST = 4_000;
/** Replaces PR_GOLD for every PR in a session that cleared a Boss Raid. */
export const BOSS_RAID_PR_GOLD = 300;

export const DEMON_CASTLE_FLOOR_COST = 1_500;
/** Floor N's target is (1 + this * N) times the recent average volume. */
export const DEMON_CASTLE_RATIO_PER_FLOOR = 0.1;

// --------------------------------------------------------------- unlocks

export const PROGRAM_PPL_COST = 3_000;
export const PROGRAM_PPL_MIN_LEVEL = 20;
export const PROGRAM_531_COST = 5_000;
export const PROGRAM_531_MIN_LEVEL = 30;
export const PROGRAM_ARNOLD_COST = 6_000;
export const PROGRAM_ARNOLD_MIN_LEVEL = 35;

export const EXERCISE_UNLOCK_COST = 400;
export const DUNGEON_TYPE_COST = 1_200;

// ------------------------------------------------------------------ skill

export const RUNE_STONE_COST = 3_000;

// ----------------------------------------------------------------- wager

/** A stake may never exceed this fraction of the gold currently held. */
export const WAGER_MAX_STAKE_FRACTION = 0.5;
/** Credited on a win, on top of a stake that was already deducted. */
export const WAGER_PAYOUT_MULTIPLIER = 3;

export const WAGER_TARGET_DUNGEONS = 4;
export const WAGER_TARGET_RUNS = 2;
export const WAGER_TARGET_QUESTS = 7;

// ------------------------------------------------------------- equipment

/** Five grades, weakest first. Order is load-bearing: it is the ladder. */
export const EQUIPMENT_GRADES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;
export type EquipmentGrade = (typeof EQUIPMENT_GRADES)[number];

/** Three slots, one item each — the whole catalog is three named items. */
export const EQUIPMENT_SLOTS = ["weapon", "armor", "accessory"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** Chance a cleared dungeon of this rank drops anything at all, before LUCK. */
export const EQUIPMENT_BASE_DROP_RATE: Record<DungeonRank, number> = {
  E: 0.03,
  D: 0.05,
  C: 0.08,
  B: 0.11,
  A: 0.15,
};

/**
 * Added to the base rate as (luck / 100) * this. LUCK caps at 100, so the
 * most it can ever add is 0.1 — enough to roughly double an E-rank's odds,
 * and reachable only after a very long quest streak.
 */
export const LUCK_DROP_COEFFICIENT = 0.1;

/**
 * How a successful drop's grade is rolled. Weights sum to 1 and descend
 * strictly, so common is the overwhelming outcome and legendary is roughly
 * one drop in fifty — which keeps Red Gate's guaranteed epic worth buying.
 */
export const EQUIPMENT_GRADE_WEIGHTS: Record<EquipmentGrade, number> = {
  common: 0.5,
  uncommon: 0.28,
  rare: 0.14,
  epic: 0.06,
  legendary: 0.02,
};

/** The effect size each grade carries, whatever the slot's effect happens to be. */
export const EQUIPMENT_GRADE_BONUS: Record<EquipmentGrade, number> = {
  common: 0.05,
  uncommon: 0.1,
  rare: 0.15,
  epic: 0.2,
  legendary: 0.25,
};

// ---------------------------------------------------- penalty mitigation

export const HOURGLASS_OF_GRACE_COST = 1_000;
/** Counted per ISO week, so the grace can never become a permanent reprieve. */
export const HOURGLASS_MAX_PER_WEEK = 1;

export const SHADOW_FEED_COST = 600;
/** Days added to a shadow's reference day, delaying weakening at read time. */
export const SHADOW_FEED_DAYS = 3;

// -------------------------------------------------------------- cosmetic

/**
 * Nothing in this section changes a number. Not one of these prices buys a
 * buff, a multiplier, or a threshold — they buy appearance and nothing
 * else. Gold may never touch a measured value and may never multiply a
 * progression value; a multiplier is only ever legitimate here when it was
 * earned by training, which none of these were.
 */
export const DASHBOARD_LAYOUT_COST = 500;

/** Priced per shadow: buying a skin for one shadow does not unlock it on another. */
export const SHADOW_SKIN_COST = {
  ember: 300,
  frost: 600,
  void: 1_000,
} as const;
export type ShadowSkinId = keyof typeof SHADOW_SKIN_COST;

export const TITLE_FRAME_COST = {
  system: 500,
  monarch: 1_200,
  sovereign: 2_500,
} as const;
export type TitleFrameId = keyof typeof TITLE_FRAME_COST;

export const AURA_BASE_COST = 3_000;
/** Each purchase multiplies the next one's price by this. */
export const AURA_COST_GROWTH = 1.5;
/**
 * The glow stops changing here. Purchases beyond this level still cost
 * escalating gold and still increment the stored level, on purpose: the
 * economy needs one sink with no ceiling, and the visual budget has one.
 */
export const AURA_VISUAL_MAX_LEVEL = 5;
