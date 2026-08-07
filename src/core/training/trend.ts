import { addDays, type TrainingDay } from "@/core/shared/training-day";

/** Both comparison windows are this long. */
export const TREND_WINDOW_DAYS = 28;

/** The best e1RM reached on one training day. */
export type E1rmPoint = {
  readonly day: TrainingDay;
  readonly e1rm: number;
};

export type LiftTrend = {
  /** Heaviest e1RM inside the last 28 days, or null if nothing was lifted. */
  readonly current: number | null;
  /** Heaviest e1RM inside the 28 days before those, or null if there is none. */
  readonly previous: number | null;
  /** current - previous when both exist. Negative means the lift went backwards. */
  readonly deltaKg: number | null;
  /** Heaviest e1RM ever recorded for this exercise. */
  readonly best: number;
  /** The first day that best was reached. Null only when there is no history. */
  readonly bestDay: TrainingDay | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Two adjacent 28-day windows, compared.
 *
 * Deliberately NOT "all-time best now versus all-time best a month ago":
 * an all-time best only ever grows, so that comparison could never show a
 * lift going backwards, and detraining is exactly what this table exists
 * to make visible. The all-time PR is reported separately, because a record
 * genuinely should not decay.
 *
 * Day strings are YYYY-MM-DD, so lexicographic comparison is chronological
 * comparison and no date parsing is needed to bucket a point.
 */
export function liftTrend(
  history: readonly E1rmPoint[],
  today: TrainingDay,
): LiftTrend {
  const currentStart = addDays(today, -(TREND_WINDOW_DAYS - 1));
  const previousStart = addDays(today, -(TREND_WINDOW_DAYS * 2 - 1));

  let current: number | null = null;
  let previous: number | null = null;
  let best = 0;
  let bestDay: TrainingDay | null = null;

  for (const p of history) {
    // A tie keeps the EARLIER day: the PR row answers "when did this
    // happen", and history arrives newest-first.
    if (
      bestDay === null ||
      p.e1rm > best ||
      (p.e1rm === best && p.day < bestDay)
    ) {
      best = p.e1rm;
      bestDay = p.day;
    }

    if (p.day >= currentStart && p.day <= today) {
      if (current === null || p.e1rm > current) current = p.e1rm;
    } else if (p.day >= previousStart && p.day < currentStart) {
      if (previous === null || p.e1rm > previous) previous = p.e1rm;
    }
  }

  return {
    current,
    previous,
    deltaKg:
      current !== null && previous !== null ? round1(current - previous) : null,
    best,
    bestDay,
  };
}
