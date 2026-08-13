import { addDays, type TrainingDay } from "@/core/shared/training-day";
import type { Container } from "@/server/container";

/**
 * Whether `day`'s Daily Quest judgment is still deferred to the 04:00 grace
 * window — an Hourglass was bought for it, and the quest row is still
 * `active` because runGraceReset has not gotten to it yet.
 *
 * A day in this state must never be read as "not completed": the hunter may
 * have actually finished it, and the true answer will only exist once the
 * grace window judges it.
 */
export async function isDayDeferred(
  container: Container,
  day: TrainingDay,
): Promise<boolean> {
  const grace = await container.mitigation.graceForDay(day);
  if (grace === null) return false;
  const quest = await container.quests.byDay(day);
  return quest !== null && quest.status === "active";
}

export async function anyDeferredInRange(
  container: Container,
  from: TrainingDay,
  to: TrainingDay,
): Promise<boolean> {
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    if (await isDayDeferred(container, cursor)) return true;
  }
  return false;
}
