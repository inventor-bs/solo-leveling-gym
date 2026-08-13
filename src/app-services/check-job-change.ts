import { daysBetween, type TrainingDay } from "@/core/shared/training-day";
import {
  jobChangeEligible,
  evaluateJobChangeProgress,
  JOB_CHANGE_VOLUME_RATIO,
  JOB_CHANGE_RETRY_LEVEL,
  JOB_CHANGE_TARGET_CLEARS,
  type JobChangeAttemptState,
} from "@/core/skill/job-change";
import {
  determineClass,
  CLASS_CATALOG,
  secondAwakeningEligible,
} from "@/core/skill/class";
import { volumeTargetMet } from "@/core/economy/challenges";
import { buildStatInput } from "./stat-input";
import { deriveStats } from "@/core/hunter/stats";
import { anyDeferredInRange } from "./deferred-day";
import { getShadowArmyView } from "./shadow-view";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

/**
 * The canonical class name for the Shadow Monarch tier, read from the same
 * catalog `determineClass`'s result gets looked up against below — never a
 * hardcoded literal, so a future rename of the catalog entry can't silently
 * break either the Second Awakening gate or the completion guard that
 * protects it.
 */
const SHADOW_MONARCH_CLASS_NAME = CLASS_CATALOG.find(
  (c) => c.id === "shadow-monarch",
)!.name;

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

  // Second Awakening is independent of level and of the ordinary Job
  // Change Quest entirely — it fires the moment all 8 muscle-mapped
  // shadows reach Knight grade, whether that happens at level 30, 60, or
  // 90. It touches none of the attempt state read and written below (no
  // call to the skills repo's attempt methods), so it cannot reopen, fail,
  // or silently overwrite a Job Change Quest streak — those only start
  // further down, past this early return. It is a one-time reclassification:
  // once className is Shadow Monarch, this branch itself has nothing left
  // to check and is skipped for good. An ordinary Job Change attempt can
  // still be active from before this fired, though — its own completion
  // path further down guards separately against overwriting the class
  // earned here.
  if (hunter.className !== SHADOW_MONARCH_CLASS_NAME) {
    const army = await getShadowArmyView(container);
    const muscleGrades = army.shadows
      .filter((s) => s.muscle !== null && s.extracted && s.grade !== null)
      .map((s) => s.grade!);
    if (secondAwakeningEligible(muscleGrades)) {
      await container.hunters.update({
        className: SHADOW_MONARCH_CLASS_NAME,
      });
      const now = container.clock.now();
      const events: DomainEvent[] = [{ type: "SecondAwakeningOffered" }];
      await container.events.record(events, day as TrainingDay, now);
      return events;
    }
  }

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

  // A prior call may have already earned the third clear but held it open
  // because a day in the window was still deferred (see the hold branch
  // below, which persists exactly this value for exactly this reason).
  // Treating that stored state as "met" here lets this call — even a
  // zero-volume reset call with no session of its own — finish what the
  // earlier call already earned, once nothing is deferred anymore.
  const alreadyMetTarget = consecutiveCleared >= JOB_CHANGE_TARGET_CLEARS;

  const sessionMetTarget =
    alreadyMetTarget ||
    (plannedVolume > 0 &&
      volumeTargetMet(
        plannedVolume,
        avgVolume * JOB_CHANGE_VOLUME_RATIO,
        avgVolume,
      ));

  const outcome = evaluateJobChangeProgress({
    consecutiveCleared,
    sessionMetTarget,
    daysIntoWindow: daysBetween(startedDay as TrainingDay, day as TrainingDay),
    dailyQuestFailedInWindow,
  });

  // A "completed" outcome can only be trusted once every day inside the
  // window has a final judgment. A day still deferred to the 04:00 grace
  // window might yet be judged missed, and the completion below is
  // one-shot — assigning a class now and having the grace window fail the
  // attempt a moment later would leave a class awarded for an attempt that
  // never actually finished.
  const completionStillDeferred =
    outcome.status === "completed" &&
    (await anyDeferredInRange(
      container,
      startedDay as TrainingDay,
      day as TrainingDay,
    ));

  if (outcome.status === "failed") {
    await container.skills.failJobChangeAttempt(now);
    events.push({
      type: "JobChangeFailed",
      retryAtLevel: JOB_CHANGE_RETRY_LEVEL,
    });
  } else if (completionStillDeferred) {
    // Do not complete, do not assign a class — but persist that the
    // target was genuinely met, at JOB_CHANGE_TARGET_CLEARS, rather than
    // writing nothing. If the deferred day resolves to "missed", the very
    // next call sees dailyQuestFailedInWindow flip to true above and fails
    // the attempt correctly regardless of this value. If it resolves to
    // "completed", alreadyMetTarget above lets the very next call — even a
    // zero-volume reset with no session of its own — finish the attempt for
    // real, instead of losing the clear and needing an extra session.
    await container.skills.updateJobChangeProgress(JOB_CHANGE_TARGET_CLEARS);
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
    // A class already earned through Second Awakening must never be
    // overwritten by the ordinary class the training stats would
    // otherwise produce. The attempt still resolves normally either way —
    // completeJobChangeAttempt above already consumed its one-shot state —
    // this only protects the stored className field itself.
    if (hunter.className !== SHADOW_MONARCH_CLASS_NAME) {
      await container.hunters.update({ className: def.name });
    }
    events.push({
      type: "ClassAssigned",
      classId: def.id,
      className: def.name,
    });
  }

  await container.events.record(events, day as TrainingDay, now);
  return events;
}
