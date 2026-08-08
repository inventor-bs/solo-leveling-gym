import type { DomainEvent } from "@/core/shared/events";
import { epoch } from "@/core/shared/units";
import { daysBetween, toTrainingDay } from "@/core/shared/training-day";
import { rankForLevel } from "@/core/hunter/progression";
import { nextFragmentToUnlock } from "@/core/narrative/arc";
import type { Container } from "@/server/container";

/**
 * Advances the story by at most one fragment.
 *
 * Called from the daily reset AND from the Archive read, the same
 * belt-and-braces pattern the Daily Quest has used since it shipped: a
 * hobby-tier cron fires once a day and may be delayed by up to an hour, and
 * the day-7 beat has to land on day 7 rather than whenever the platform
 * gets around to it.
 *
 * The one-fragment-per-day cap is what makes the ordering rule survivable.
 * Because a fragment waits for the one before it, gates that opened while
 * the arc was stalled pile up; releasing them all at once would spend three
 * beats of a fifteen-beat story on a single screen.
 *
 * Persists its own event before returning it, so a caller that also has
 * events of its own must not fold this into what it writes a second time.
 */
export async function ensureNarrativeUnlocks(
  container: Container,
): Promise<DomainEvent[]> {
  const hunter = await container.hunters.get();
  if (!hunter) return [];

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);

  const latest = await container.narrative.latestUnlockedDay();
  if (latest === today) return [];

  const startDay = toTrainingDay(
    epoch(hunter.createdAt),
    container.tzOffsetMinutes,
  );
  const next = nextFragmentToUnlock(await container.narrative.unlockedIds(), {
    daysSinceStart: daysBetween(startDay, today),
    // Derived from level rather than the stored rank column, which only
    // moves on level-up and can lag behind.
    level: hunter.level,
    rank: rankForLevel(hunter.level),
  });
  if (!next) return [];

  await container.narrative.unlock(next.id, next.ordinal, today, now);

  const events: DomainEvent[] = [
    {
      type: "NarrativeFragmentUnlocked",
      fragmentId: next.id,
      ordinal: next.ordinal,
    },
  ];
  await container.events.record(events, today, now);
  return events;
}
