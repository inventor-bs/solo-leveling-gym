export const JOB_CHANGE_MIN_LEVEL = 40;
export const JOB_CHANGE_RETRY_LEVEL = 45;
export const JOB_CHANGE_VOLUME_RATIO = 1.2;
export const JOB_CHANGE_TARGET_CLEARS = 3;
export const JOB_CHANGE_WINDOW_DAYS = 7;

export type JobChangeAttemptState = {
  readonly startedDay: string;
  readonly consecutiveCleared: number;
  readonly failedAt: number | null;
  readonly completedAt: number | null;
};

/**
 * Failing costs nothing but time: a failed attempt is retryable once the
 * hunter reaches the retry level, never sooner. A completed attempt is
 * permanent and can never be retaken.
 */
export function jobChangeEligible(
  level: number,
  attempt: JobChangeAttemptState | null,
): boolean {
  if (level < JOB_CHANGE_MIN_LEVEL) return false;
  if (attempt?.completedAt != null) return false;
  if (attempt?.failedAt != null && level < JOB_CHANGE_RETRY_LEVEL) return false;
  return true;
}

export type JobChangeProgressInput = {
  readonly consecutiveCleared: number;
  readonly sessionMetTarget: boolean;
  readonly daysIntoWindow: number;
  readonly dailyQuestFailedInWindow: boolean;
};

export type JobChangeProgressOutcome =
  | { readonly status: "in-progress"; readonly consecutiveCleared: number }
  | { readonly status: "completed" }
  | { readonly status: "failed" };

/**
 * A Daily Quest failure or an elapsed window fails the attempt outright —
 * checked before the streak itself, so a session that would have completed
 * the streak on the same day the window elapses does not sneak through.
 */
export function evaluateJobChangeProgress(
  input: JobChangeProgressInput,
): JobChangeProgressOutcome {
  if (input.dailyQuestFailedInWindow) return { status: "failed" };
  if (input.daysIntoWindow >= JOB_CHANGE_WINDOW_DAYS)
    return { status: "failed" };

  const consecutiveCleared = input.sessionMetTarget
    ? input.consecutiveCleared + 1
    : 0;
  if (consecutiveCleared >= JOB_CHANGE_TARGET_CLEARS)
    return { status: "completed" };
  return { status: "in-progress", consecutiveCleared };
}
