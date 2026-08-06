import { addDays, type TrainingDay } from "@/core/shared/training-day";

export type QuestOutcome = {
  readonly day: TrainingDay;
  readonly completed: boolean;
};

/**
 * Consecutive completed days, counted backwards.
 *
 * Today counts only if it is already done; if it is still pending the
 * count starts at yesterday. Without that, every streak would read 0
 * every morning until the hunter finished the day's quest.
 */
export function currentStreak(
  history: readonly QuestOutcome[],
  today: TrainingDay,
): number {
  const completedByDay = new Map<string, boolean>();
  for (const entry of history) {
    completedByDay.set(entry.day, entry.completed);
  }

  let cursor: TrainingDay =
    completedByDay.get(today) === true ? today : addDays(today, -1);

  let streak = 0;
  while (completedByDay.get(cursor) === true) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
