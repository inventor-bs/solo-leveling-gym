/**
 * Everything the week that just ended actually contained. Every field is
 * counted from stored rows — sessions, quests and penalty episodes — so
 * there is no counter to keep in step and nothing to reset.
 */
export type PerfectWeekInput = {
  /** Days inside the week the program schedules a lifting session on. */
  readonly scheduledDays: readonly string[];
  /** Days inside the week that carry at least one completed session. */
  readonly trainedDays: readonly string[];
  readonly questsIssued: number;
  readonly questsCompleted: number;
  readonly penaltiesStarted: number;
};

/**
 * All three conditions, no partial credit:
 *   every scheduled day trained ON that day, every issued quest completed,
 *   and no penalty episode opened inside the week.
 *
 * The two emptiness guards are not pedantry. A week that scheduled nothing
 * and issued nothing would satisfy "every scheduled day was trained" and
 * "every quest was completed" vacuously, and pay 500 gold for a week the
 * hunter spent doing nothing at all.
 */
export function isPerfectWeek(input: PerfectWeekInput): boolean {
  if (input.scheduledDays.length === 0) return false;
  if (input.questsIssued === 0) return false;
  if (input.penaltiesStarted > 0) return false;
  if (input.questsCompleted < input.questsIssued) return false;

  const trained = new Set(input.trainedDays);
  return input.scheduledDays.every((day) => trained.has(day));
}
