import type { Kg } from "@/core/shared/units";

export interface Stats {
  readonly strength: number;
  readonly agility: number;
  readonly vitality: number;
  readonly intelligence: number;
  readonly perception: number;
  readonly luck: number;
}

/**
 * Input for deriving stats. EVERYTHING here comes from real training logs.
 * There is no field for buffs, items, or manual point allocation —
 * that's deliberate: stats are derived, never assigned.
 */
export interface StatInput {
  readonly mainLiftE1rms: ReadonlyMap<string, Kg>;
  readonly km28d: number;
  readonly avgPaceSecPerKm: number | null;
  readonly volume28d: number;
  readonly sessionsCompleted28d: number;
  readonly sessionsScheduled28d: number;
  readonly setsCompleted28d: number;
  readonly setsPlanned28d: number;
  readonly sideQuestsCompleted28d: number;
  readonly sideQuestsIssued28d: number;
  readonly streakDays: number;
  readonly hiddenQuestsFound: number;
}

/** Balance constants. Tune here once real usage data comes in. */
export const STAT_TUNING = {
  strengthPerKgE1rm: 1 / 10,
  agilityPerKm: 1.5,
  paceBaselineSecPerKm: 420, // 7:00/km
  paceBonusDivisor: 6,
  paceBonusCap: 30,
  vitalityPerVolume: 1 / 2000,
  vitalityPerSession: 1.5,
  intelligenceScheduleWeight: 0.7,
  intelligenceSideQuestWeight: 0.3,
  luckPerStreakDay: 0.8,
  luckPerHiddenQuest: 5,
  luckCap: 100,
} as const;

export function emptyStatInput(): StatInput {
  return {
    mainLiftE1rms: new Map(),
    km28d: 0,
    avgPaceSecPerKm: null,
    volume28d: 0,
    sessionsCompleted28d: 0,
    sessionsScheduled28d: 0,
    setsCompleted28d: 0,
    setsPlanned28d: 0,
    sideQuestsCompleted28d: 0,
    sideQuestsIssued28d: 0,
    streakDays: 0,
    hiddenQuestsFound: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ratioPercent(done: number, planned: number): number {
  if (planned <= 0) return 0;
  return clamp((done / planned) * 100, 0, 100);
}

export function deriveStats(input: StatInput): Stats {
  const t = STAT_TUNING;

  let sumE1rm = 0;
  for (const v of input.mainLiftE1rms.values()) sumE1rm += v;
  const strength = sumE1rm * t.strengthPerKgE1rm;

  const paceBonus =
    input.avgPaceSecPerKm === null
      ? 0
      : clamp(
          (t.paceBaselineSecPerKm - input.avgPaceSecPerKm) / t.paceBonusDivisor,
          0,
          t.paceBonusCap,
        );
  const agility = input.km28d * t.agilityPerKm + paceBonus;

  const vitality =
    input.volume28d * t.vitalityPerVolume +
    input.sessionsCompleted28d * t.vitalityPerSession;

  const perception = ratioPercent(input.setsCompleted28d, input.setsPlanned28d);

  const intelligence =
    ratioPercent(input.sessionsCompleted28d, input.sessionsScheduled28d) *
      t.intelligenceScheduleWeight +
    ratioPercent(input.sideQuestsCompleted28d, input.sideQuestsIssued28d) *
      t.intelligenceSideQuestWeight;

  const luck = clamp(
    input.streakDays * t.luckPerStreakDay +
      input.hiddenQuestsFound * t.luckPerHiddenQuest,
    0,
    t.luckCap,
  );

  return {
    strength: Math.round(strength),
    agility: Math.round(agility),
    vitality: Math.round(vitality),
    intelligence: Math.round(intelligence),
    perception: Math.round(perception),
    luck: Math.round(luck),
  };
}
