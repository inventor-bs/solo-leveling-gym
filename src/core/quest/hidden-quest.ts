/** The window this quest measures: the hunter's first seven calendar days. */
export const SEVENTH_DAY_WINDOW_DAYS = 7;
/** Gold per day inside that window on which real training was logged. */
export const SEVENTH_DAY_GOLD_PER_ACTIVE_DAY = 30;

export type HiddenQuestDef = {
  readonly id: string;
  readonly name: string;
  /** Shown once, on the card that appears the moment the quest is revealed. */
  readonly revealLine: string;
};

export const SEVENTH_DAY: HiddenQuestDef = {
  id: "the-seventh-day",
  name: "The Seventh Day",
  revealLine:
    "Hidden Quest complete: The Seventh Day. Most who register never reach it. You were not told it existed because being told would have changed the result.",
};

export type SeventhDayInput = {
  /** Calendar days since the hunter registered. */
  readonly daysSinceStart: number;
  /** Days inside the first-seven-day window carrying a session or a run. */
  readonly activeDays: number;
};

export type SeventhDayOutcome = {
  readonly revealed: boolean;
  readonly goldAwarded: number;
};

/**
 * Whether the first hidden quest may surface, and what it pays.
 *
 * Deterministic on purpose. Hidden quests are normally probabilistic and
 * biased by LUCK, but this one exists to guarantee that something happens
 * on the seventh day — the first of the two known drop-off cliffs — so a
 * dice roll would defeat the only reason it exists. It takes no RngPort and
 * no luck value.
 *
 * Two conditions, not one. The date alone is not enough: paying gold for a
 * week passing would be currency granted for time rather than work. At
 * least one real training day is required, and the payout scales with how
 * many there were, capped at the window itself so no accounting quirk can
 * pay for an eighth day inside a seven-day week.
 *
 * Gold only. EXP is the spine of level and rank and keeps coming from
 * sessions, quests and runs alone.
 */
export function evaluateSeventhDay(input: SeventhDayInput): SeventhDayOutcome {
  if (input.daysSinceStart < SEVENTH_DAY_WINDOW_DAYS) {
    return { revealed: false, goldAwarded: 0 };
  }
  if (input.activeDays < 1) {
    return { revealed: false, goldAwarded: 0 };
  }
  const days = Math.min(input.activeDays, SEVENTH_DAY_WINDOW_DAYS);
  return {
    revealed: true,
    goldAwarded: days * SEVENTH_DAY_GOLD_PER_ACTIVE_DAY,
  };
}

export const FIVE_DAY_STREAK_WINDOW_DAYS = 5;
export const FIVE_DAY_STREAK_STEALTH_WINDOW_DAYS = 3;
export const FIVE_DAY_STREAK_GOLD = 200;

export const FIVE_DAY_STREAK: HiddenQuestDef = {
  id: "five-day-streak",
  name: "Unbroken",
  revealLine:
    "Hidden Quest complete: Unbroken. Five days, no excuses. The System was watching to see if you would blink.",
};

export type FiveDayStreakInput = {
  readonly streakDays: number;
  readonly stealthEquipped: boolean;
};
export type FiveDayStreakOutcome = {
  readonly revealed: boolean;
  readonly goldAwarded: number;
};

/** Stealth shortens the window to 3 days — hidden quests trigger denser when equipped. */
export function evaluateFiveDayStreak(
  input: FiveDayStreakInput,
): FiveDayStreakOutcome {
  const threshold = input.stealthEquipped
    ? FIVE_DAY_STREAK_STEALTH_WINDOW_DAYS
    : FIVE_DAY_STREAK_WINDOW_DAYS;
  if (input.streakDays < threshold) return { revealed: false, goldAwarded: 0 };
  return { revealed: true, goldAwarded: FIVE_DAY_STREAK_GOLD };
}

export const FIRST_RECORD_GOLD = 100;

export const FIRST_RECORD: HiddenQuestDef = {
  id: "first-record",
  name: "First Record",
  revealLine:
    "Hidden Quest complete: First Record. The number that used to be your limit is now just a number you passed.",
};

export type FirstRecordInput = { readonly prCountEver: number };
export type FirstRecordOutcome = {
  readonly revealed: boolean;
  readonly goldAwarded: number;
};

export function evaluateFirstRecord(
  input: FirstRecordInput,
): FirstRecordOutcome {
  if (input.prCountEver < 1) return { revealed: false, goldAwarded: 0 };
  return { revealed: true, goldAwarded: FIRST_RECORD_GOLD };
}

export const EARLY_RISER_GOLD = 100;

export const EARLY_RISER: HiddenQuestDef = {
  id: "early-riser",
  name: "Early Riser",
  revealLine:
    "Hidden Quest complete: Early Riser. Most hunters are still asleep. You were already in the gate.",
};

export type EarlyRiserInput = { readonly hasEarlySession: boolean };
export type EarlyRiserOutcome = {
  readonly revealed: boolean;
  readonly goldAwarded: number;
};

export function evaluateEarlyRiser(input: EarlyRiserInput): EarlyRiserOutcome {
  if (!input.hasEarlySession) return { revealed: false, goldAwarded: 0 };
  return { revealed: true, goldAwarded: EARLY_RISER_GOLD };
}
