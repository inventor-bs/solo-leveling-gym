import { exp as makeExp, type Exp } from "@/core/shared/units";

export type Rank = "E" | "D" | "C" | "B" | "A" | "S" | "National" | "Monarch";

/**
 * Balance constants. The E→D threshold is tuned so a consistent
 * trainee reaches it around day 12–16. Adjust here when real usage
 * data comes in.
 */
export const EXP_BASE = 100;
export const EXP_EXPONENT = 1.35;

export const RANK_THRESHOLDS: readonly { rank: Rank; minLevel: number }[] = [
  { rank: "Monarch", minLevel: 100 },
  { rank: "National", minLevel: 90 },
  { rank: "S", minLevel: 70 },
  { rank: "A", minLevel: 50 },
  { rank: "B", minLevel: 35 },
  { rank: "C", minLevel: 20 },
  { rank: "D", minLevel: 10 },
  { rank: "E", minLevel: 0 },
] as const;

/** EXP required to go from `level` to `level + 1`. */
export function expToNextLevel(level: number): Exp {
  const l = Math.max(1, Math.floor(level));
  return makeExp(Math.round(EXP_BASE * Math.pow(l, EXP_EXPONENT)));
}

/**
 * Applies gained EXP and resolves every level-up it triggers.
 * Negative EXP (Penalty Zone) subtracts from the current pool but
 * NEVER drops a level.
 */
export function applyExp(
  currentLevel: number,
  currentExp: Exp,
  gained: Exp,
): { level: number; exp: Exp; levelsGained: number } {
  let level = Math.max(1, Math.floor(currentLevel));
  let pool = currentExp + gained;

  if (pool < 0) {
    return { level, exp: makeExp(0), levelsGained: 0 };
  }

  let levelsGained = 0;
  let needed = expToNextLevel(level);
  while (pool >= needed) {
    pool -= needed;
    level += 1;
    levelsGained += 1;
    needed = expToNextLevel(level);
  }

  return { level, exp: makeExp(pool), levelsGained };
}

export function rankForLevel(level: number): Rank {
  for (const t of RANK_THRESHOLDS) {
    if (level >= t.minLevel) return t.rank;
  }
  return "E";
}
