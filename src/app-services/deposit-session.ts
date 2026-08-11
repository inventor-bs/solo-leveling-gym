import { ok, err, type Result } from "@/core/shared/result";
import {
  isoWeekdayOf,
  startOfIsoWeek,
  type TrainingDay,
} from "@/core/shared/training-day";
import { effectiveScheduledWeekdays } from "@/core/skill/schedule-swap";
import type { Container } from "@/server/container";

export type DepositSessionResult = { bankedSessions: number };

export type DepositSessionError =
  | { type: "skill-not-equipped" }
  | { type: "no-session-to-deposit" }
  | { type: "not-a-surplus-session" }
  | { type: "already-deposited" };

/**
 * Shadow Storage: banks the most recently completed lifting session, but
 * only when it fell on a weekday the weekly schedule does not call for —
 * a genuine surplus, not a session that was going to happen anyway. Each
 * completed session can only be banked once, tracked by its real session
 * id rather than its calendar day, since a day string alone could not
 * distinguish two different sessions that happened to land on the same day.
 */
export async function depositSession(
  container: Container,
): Promise<Result<DepositSessionResult, DepositSessionError>> {
  const equippedSkills = new Set(await container.skills.equippedIds());
  if (!equippedSkills.has("shadow-storage")) {
    return err({ type: "skill-not-equipped" });
  }

  const lastDay = await container.training.lastCompletedSessionDay();
  if (!lastDay) return err({ type: "no-session-to-deposit" });

  const sessionsOnDay = await container.training.completedSessionsBetween(
    lastDay,
    lastDay,
  );
  const latestSession = sessionsOnDay[0] ?? null;

  const bank = await container.skills.bank();
  if (latestSession && latestSession.id === bank.lastDepositedSessionId) {
    return err({ type: "already-deposited" });
  }

  // A Shadow Exchange swap active for lastDay's week must count here the
  // same way it counts in startSession's own missed-session loop — otherwise
  // a session that startSession already treats as scheduled (and uses to
  // forgive a different missed day) could also be banked here as a
  // "surplus", letting one real session cancel two misses.
  const scheduled = await container.programs.allDays();
  const baseWeekdays = new Set(scheduled.map((d) => d.weekday));
  const swap = await container.skills.swapForWeek(
    startOfIsoWeek(lastDay as TrainingDay),
  );
  const scheduledWeekdays = effectiveScheduledWeekdays(
    baseWeekdays,
    swap,
    lastDay,
  );
  if (scheduledWeekdays.has(isoWeekdayOf(lastDay as TrainingDay))) {
    return err({ type: "not-a-surplus-session" });
  }

  const sessionId = latestSession?.id ?? lastDay;
  await container.skills.deposit(sessionId, container.clock.now());
  const updated = await container.skills.bank();
  return ok({ bankedSessions: updated.bankedSessions });
}
