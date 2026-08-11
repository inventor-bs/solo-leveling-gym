export type ShadowGrade =
  "Normal" | "Elite" | "Knight" | "Marshal" | "Commander" | "Grand Marshal";

/**
 * Descending order — same lookup shape as RANK_THRESHOLDS in
 * core/hunter/progression.ts: walk from the top, first threshold the EXP
 * clears wins. Provisional tuning; revisit once real training volume
 * across many weeks shows where these should actually sit.
 */
export const SHADOW_GRADE_THRESHOLDS: readonly {
  grade: ShadowGrade;
  minExp: number;
}[] = [
  { grade: "Grand Marshal", minExp: 250_000 },
  { grade: "Commander", minExp: 100_000 },
  { grade: "Marshal", minExp: 40_000 },
  { grade: "Knight", minExp: 15_000 },
  { grade: "Elite", minExp: 5_000 },
  { grade: "Normal", minExp: 0 },
] as const;

export const WEAKEN_AFTER_DAYS = 7;
export const WEAKEN_RATE_PER_DAY = 0.02;

export function gradeForExp(exp: number): ShadowGrade {
  for (const t of SHADOW_GRADE_THRESHOLDS) {
    if (exp >= t.minExp) return t.grade;
  }
  return "Normal";
}

function gradeIndex(grade: ShadowGrade): number {
  return SHADOW_GRADE_THRESHOLDS.findIndex((t) => t.grade === grade);
}

/**
 * The Adjustment applied at read time — storedExp itself never changes here.
 * Decay is computed from the raw stored value, then floored at the minExp
 * of the tier one step below wherever that raw value currently sits. That
 * floor is what makes "at most one grade" a property of the function rather
 * than a rule someone has to remember to enforce elsewhere.
 */
export function weakenedExp(
  storedExp: number,
  daysInactive: number,
  afterDays: number = WEAKEN_AFTER_DAYS,
  ratePerDay: number = WEAKEN_RATE_PER_DAY,
): number {
  const days = Math.max(0, Math.floor(daysInactive));
  if (days < afterDays) return storedExp;

  const decayDays = days - afterDays + 1;
  const decayed = storedExp * Math.pow(1 - ratePerDay, decayDays);

  const currentGrade = gradeForExp(storedExp);
  const currentIdx = gradeIndex(currentGrade);
  const oneTierDown =
    SHADOW_GRADE_THRESHOLDS[
      Math.min(currentIdx + 1, SHADOW_GRADE_THRESHOLDS.length - 1)
    ]!;

  return Math.max(oneTierDown.minExp, Math.round(decayed));
}
