import {
  MONARCH_MORNING_SESSIONS,
  RETURNED_PENALTY_EXITS,
  UNYIELDING_STREAK_DAYS,
  type TitleId,
} from "./catalog";

/** Every number here is measured from training logs. There is no field a buff could fill. */
export type TitleProgress = {
  readonly streakDays: number;
  readonly morningSessions: number;
  readonly penaltyExits: number;
};

/**
 * Which titles the CURRENT numbers qualify for.
 *
 * This is deliberately memoryless: it reports what is true right now and
 * nothing else. Permanence lives in the stored earnedAt timestamp, so a
 * streak that later breaks cannot take Unyielding back, and this function
 * stays a pure comparison that a test can pin exactly.
 */
export function earnedTitleIds(progress: TitleProgress): TitleId[] {
  const earned: TitleId[] = [];
  if (progress.streakDays >= UNYIELDING_STREAK_DAYS) earned.push("unyielding");
  if (progress.morningSessions >= MONARCH_MORNING_SESSIONS) {
    earned.push("monarch-of-dawn");
  }
  if (progress.penaltyExits >= RETURNED_PENALTY_EXITS) {
    earned.push("one-who-returned");
  }
  return earned;
}
