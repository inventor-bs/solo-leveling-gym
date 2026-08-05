/**
 * Fatigue is the LIMITING stat (spec §5.5) — the one stat that should
 * not go up. It's the only mechanic in the app that rewards resting,
 * and it's what caps overtraining.
 */
export type FatigueLevel = "normal" | "warning" | "critical";

export const FATIGUE_TUNING = {
  baseGainPerSession: 20,
  decayPerDay: 12,
  decayPerDayWellRested: 18,
  warningThreshold: 70,
  criticalThreshold: 85,
  criticalExpMultiplier: 0.5,
  max: 100,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Adds fatigue proportional to this session's volume relative to the
 * 4-week average. With no history yet (avgVolume = 0), uses the base amount.
 */
export function fatigueAfterSession(
  current: number,
  sessionVolume: number,
  avgVolume: number,
): number {
  const ratio = avgVolume > 0 ? sessionVolume / avgVolume : 1;
  const gain = FATIGUE_TUNING.baseGainPerSession * ratio;
  return clamp(Math.round(current + gain), 0, FATIGUE_TUNING.max);
}

export function decayFatigue(
  current: number,
  days: number,
  sleptWell: boolean,
): number {
  const perDay = sleptWell
    ? FATIGUE_TUNING.decayPerDayWellRested
    : FATIGUE_TUNING.decayPerDay;
  return clamp(Math.round(current - perDay * days), 0, FATIGUE_TUNING.max);
}

export function fatigueLevel(value: number): FatigueLevel {
  if (value >= FATIGUE_TUNING.criticalThreshold) return "critical";
  if (value >= FATIGUE_TUNING.warningThreshold) return "warning";
  return "normal";
}

/** Critical fatigue halves EXP earned — spec §5.5. */
export function expMultiplierForFatigue(value: number): number {
  return fatigueLevel(value) === "critical"
    ? FATIGUE_TUNING.criticalExpMultiplier
    : 1;
}
