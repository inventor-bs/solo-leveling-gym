import type { DungeonRank } from "@/core/training/dungeon-rank";
import {
  EQUIPMENT_BASE_DROP_RATE,
  EQUIPMENT_GRADES,
  EQUIPMENT_GRADE_BONUS,
  EQUIPMENT_GRADE_WEIGHTS,
  EQUIPMENT_SLOTS,
  LUCK_DROP_COEFFICIENT,
  type EquipmentGrade,
  type EquipmentSlot,
} from "./pricing";

export type EquipmentDef = {
  readonly slot: EquipmentSlot;
  readonly name: string;
  /** Rendered on the Inventory page next to the grade's actual percentage. */
  readonly effect: string;
};

/**
 * Three slots, three named items, no variants.
 *
 * Every effect below scales a PROGRESSION number (EXP, gold) or an
 * ADJUSTMENT one (fatigue gain). None of them touches volume, e1RM, PR
 * detection or dungeon rank, and none of them can be bought — an item
 * exists only because a real dungeon was cleared and the roll came up.
 */
export const EQUIPMENT_CATALOG: Record<EquipmentSlot, EquipmentDef> = {
  weapon: {
    slot: "weapon",
    name: "Knight Killer",
    effect: "More EXP from any session that trained Back",
  },
  armor: {
    slot: "armor",
    name: "Shadow Compression Gear",
    effect: "Fatigue accumulates more slowly",
  },
  accessory: {
    slot: "accessory",
    name: "Hunter's Charm",
    effect: "More gold from the Daily Quest",
  },
};

/**
 * The odds a cleared dungeon drops anything.
 *
 * LUCK is derived from streak and hidden quests, so this whole expression
 * traces back to training. A negative LUCK cannot exist but is clamped
 * anyway rather than allowed to lower the base rate.
 */
export function dropChance(rank: DungeonRank, luck: number): number {
  const luckBonus = (Math.max(0, luck) / 100) * LUCK_DROP_COEFFICIENT;
  return EQUIPMENT_BASE_DROP_RATE[rank] + luckBonus;
}

/**
 * Turns a float in [0, 1) into a grade, skewed hard toward common.
 *
 * Takes the number rather than the RngPort so the distribution can be
 * asserted with exact inputs; the port is touched at the single call site
 * that rolls a drop.
 */
export function rollGrade(roll: number): EquipmentGrade {
  const clamped = Math.min(Math.max(roll, 0), 1);
  let cumulative = 0;
  for (const grade of EQUIPMENT_GRADES) {
    cumulative += EQUIPMENT_GRADE_WEIGHTS[grade];
    if (clamped < cumulative) return grade;
  }
  // The weights sum to a hair over 1 in floating point, so a roll very
  // close to 1 can escape the loop. The top grade is the correct answer.
  return EQUIPMENT_GRADES[EQUIPMENT_GRADES.length - 1]!;
}

function gradeIndex(grade: EquipmentGrade): number {
  return EQUIPMENT_GRADES.indexOf(grade);
}

/**
 * Whether a fresh roll should displace what is in the slot. Ties do not
 * replace — the same reason a tied e1RM is not a PR.
 */
export function isHigherGrade(
  candidate: EquipmentGrade,
  current: EquipmentGrade | null,
): boolean {
  if (current === null) return true;
  return gradeIndex(candidate) > gradeIndex(current);
}

/** The effect size a grade carries, or zero for an empty slot. */
export function gradeBonus(grade: EquipmentGrade | null): number {
  return grade === null ? 0 : EQUIPMENT_GRADE_BONUS[grade];
}

/**
 * Knight Killer. Pays only when the session actually loaded Back — the
 * item is a reward for training that muscle group, not a flat EXP tax cut.
 */
export function equipmentExpMultiplier(
  weaponGrade: EquipmentGrade | null,
  backVolume: number,
): number {
  if (backVolume <= 0) return 1;
  return 1 + gradeBonus(weaponGrade);
}

/**
 * Shadow Compression Gear. Multiplies the fatigue GAIN a session produces,
 * which is the computation layer — the stored fatigue value and every
 * logged set behind it are untouched.
 */
export function equipmentFatigueGainMultiplier(
  armorGrade: EquipmentGrade | null,
): number {
  return 1 - gradeBonus(armorGrade);
}

/** Hunter's Charm. Applies to the Daily Quest reward and nothing else. */
export function equipmentQuestGoldMultiplier(
  accessoryGrade: EquipmentGrade | null,
): number {
  return 1 + gradeBonus(accessoryGrade);
}

/** Runtime guards for the plain TEXT columns the equipment table stores. */
export function isEquipmentSlot(value: string): value is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

export function isEquipmentGrade(value: string): value is EquipmentGrade {
  return (EQUIPMENT_GRADES as readonly string[]).includes(value);
}
