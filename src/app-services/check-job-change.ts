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
 * Called once per completed session (with that session's real volume) and
 * once per daily reset (with plannedVolume and avgVolume both 0, which
 * volumeTargetMet always reads as "not met" — a reset with no session
 * cannot advance the clear streak, but it must still catch an elapsed
 * seven-day window or a Daily Quest failure judged during that reset).
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

  const now = container.clock.now();
  const events: DomainEvent[] = [];

  const active =
    existing && existing.completedAt === null && existing.failedAt === null
      ? existing
      : null;
  if (!active) {
    await container.skills.startJobChangeAttempt(day, now);
    events.push({ type: "JobChangeQuestStarted", day });
  }

  const startedDay = active?.startedDay ?? day;
  const consecutiveCleared = active?.consecutiveCleared ?? 0;

  const outcomes = await container.quests.recentOutcomes(400);
  const dailyQuestFailedInWindow = outcomes.some(
    (o) => o.day >= startedDay && o.day <= day && !o.completed,
  );

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
    await container.skills.updateJobChangeProgress(outcome.consecutiveCleared);
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
