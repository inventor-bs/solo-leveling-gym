import { daysBetween, type TrainingDay } from "@/core/shared/training-day";
import {
  jobChangeEligible,
  evaluateJobChangeProgress,
  JOB_CHANGE_VOLUME_RATIO,
  JOB_CHANGE_RETRY_LEVEL,
  type JobChangeAttemptState,
} from "@/core/skill/job-change";
import { determineClass, CLASS_CATALOG } from "@/core/skill/class";
import { volumeTargetMet } from "@/core/economy/challenges";
import { buildStatInput } from "./stat-input";
import { deriveStats } from "@/core/hunter/stats";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

/**
 * Re-evaluates the Job Change Quest against one day's training outcome.
 *
 * Called once per completed session (with that session's real volume,
 * which can start a brand-new attempt) and once per daily reset (with
 * plannedVolume and avgVolume both 0). The zero-volume reset call can only
 * ever check an attempt already in progress — for an elapsed seven-day
 * window or a Daily Quest failure judged during that same reset — and
 * never opens a new one: a hunter who has never trained a qualifying
 * session must never have an attempt silently started (and possibly
 * immediately failed) by a reset that ran on an ordinary day. On an
 * ordinary night where nothing failed or expired, the reset call must
 * also leave a real streak untouched rather than overwrite it with the 0
 * "no session happened" naturally computes to — only a real session's own
 * call is allowed to write a new consecutiveCleared value.
 *
 * Persists its own events, the same discipline awardEarnedTitles and
 * revealHiddenQuests already follow: a caller that has events of its own
 * must fold this function's return value into its own list rather than
 * persist them a second time.
 */
export async function checkJobChangeProgress(
  container: Container,
  day: string,
  plannedVolume: number,
  avgVolume: number,
): Promise<DomainEvent[]> {
  const hunter = await container.hunters.get();
  if (!hunter) return [];

  const existing = await container.skills.jobChangeAttempt();
  const attemptState: JobChangeAttemptState | null = existing && {
    startedDay: existing.startedDay,
    consecutiveCleared: existing.consecutiveCleared,
    failedAt: existing.failedAt,
    completedAt: existing.completedAt,
  };

  if (!jobChangeEligible(hunter.level, attemptState)) return [];

  const active =
    existing && existing.completedAt === null && existing.failedAt === null
      ? existing
      : null;

  // A zero-volume call — the daily-reset path — exists only to catch an
  // ALREADY-ACTIVE attempt's window expiry or a Daily Quest failure. It
  // must never open a new attempt of its own: a hunter who has never
  // trained a qualifying session could otherwise get one silently opened
  // (and possibly immediately failed) by a reset that ran on an ordinary
  // day, with zero training involved.
  if (!active && plannedVolume <= 0) return [];

  const now = container.clock.now();
  const events: DomainEvent[] = [];

  if (!active) {
    await container.skills.startJobChangeAttempt(day, now);
    events.push({ type: "JobChangeQuestStarted", day });
  }

  const startedDay = active?.startedDay ?? day;
  const consecutiveCleared = active?.consecutiveCleared ?? 0;

  // Only a row actually judged "missed" counts as a failure. A row still
  // "active" — today's own quest, only ever judged at tomorrow's reset, or
  // a day deferred to the Hourglass grace window — must never be read as a
  // failure just because it has not been marked completed yet.
  const rows = await container.quests.between(startedDay, day);
  const dailyQuestFailedInWindow = rows.some((r) => r.status === "missed");

  const sessionMetTarget =
    plannedVolume > 0 &&
    volumeTargetMet(
      plannedVolume,
      avgVolume * JOB_CHANGE_VOLUME_RATIO,
      avgVolume,
    );

  const outcome = evaluateJobChangeProgress({
    consecutiveCleared,
    sessionMetTarget,
    daysIntoWindow: daysBetween(startedDay as TrainingDay, day as TrainingDay),
    dailyQuestFailedInWindow,
  });

  if (outcome.status === "failed") {
    await container.skills.failJobChangeAttempt(now);
    events.push({
      type: "JobChangeFailed",
      retryAtLevel: JOB_CHANGE_RETRY_LEVEL,
    });
  } else if (outcome.status === "in-progress") {
    // A zero-volume call — the reset path — has nothing new to report once
    // failure and window-expiry are already ruled out above: it did not
    // train, so it must not overwrite a real streak earned by an actual
    // session with the 0 evaluateJobChangeProgress computes for "nothing
    // happened." Only a real session's own call (plannedVolume > 0) is
    // allowed to write a new streak value, whether that's an increment or
    // the reset-to-0 a missed volume target on that session genuinely earns.
    if (plannedVolume > 0) {
      await container.skills.updateJobChangeProgress(
        outcome.consecutiveCleared,
      );
    }
  } else {
    await container.skills.completeJobChangeAttempt(now);
    const stats = deriveStats(await buildStatInput(container));
    const classId = determineClass(stats);
    const def = CLASS_CATALOG.find((c) => c.id === classId)!;
    await container.hunters.update({ className: def.name });
    events.push({
      type: "ClassAssigned",
      classId: def.id,
      className: def.name,
    });
  }

  await container.events.record(events, day as TrainingDay, now);
  return events;
}
