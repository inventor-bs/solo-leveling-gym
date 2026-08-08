import type { DomainEvent } from "@/core/shared/events";
import { epoch, gold as makeGold } from "@/core/shared/units";
import {
  addDays,
  daysBetween,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  evaluateSeventhDay,
  SEVENTH_DAY,
  SEVENTH_DAY_WINDOW_DAYS,
} from "@/core/quest/hidden-quest";
import type { Container } from "@/server/container";

/**
 * Days inside [from, to] on which anything real was logged.
 *
 * A Set because a day carrying both a session and a run is one day of
 * training, not two — paying twice for it would inflate a Progression
 * number past what was actually done.
 */
async function countActiveDays(
  container: Container,
  from: TrainingDay,
  to: TrainingDay,
): Promise<number> {
  const days = new Set<string>();
  for (const day of await container.training.completedSessionDaysBetween(
    from,
    to,
  )) {
    days.add(day);
  }
  for (const run of await container.training.runsBetween(from, to)) {
    days.add(run.day);
  }
  return days.size;
}

/**
 * Surfaces any hidden quest whose condition has quietly become true.
 *
 * There is exactly one today, so this reads as one explicit block rather
 * than a condition-evaluation framework: a generic engine for conditions
 * that do not exist yet would be guesswork about their shape.
 *
 * Persists its own events before returning them — a caller with events of
 * its own must not write these a second time.
 */
export async function revealHiddenQuests(
  container: Container,
): Promise<DomainEvent[]> {
  const hunter = await container.hunters.get();
  if (!hunter) return [];
  if (await container.hiddenQuests.byId(SEVENTH_DAY.id)) return [];

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  const startDay = toTrainingDay(
    epoch(hunter.createdAt),
    container.tzOffsetMinutes,
  );
  // Inclusive window: registration day plus the six that follow.
  const windowEnd = addDays(startDay, SEVENTH_DAY_WINDOW_DAYS - 1);

  const outcome = evaluateSeventhDay({
    daysSinceStart: daysBetween(startDay, today),
    activeDays: await countActiveDays(container, startDay, windowEnd),
  });
  if (!outcome.revealed) return [];

  const won = await container.hiddenQuests.reveal({
    id: SEVENTH_DAY.id,
    name: SEVENTH_DAY.name,
    revealedDay: today,
    revealedAt: now,
    goldAwarded: outcome.goldAwarded,
  });
  if (!won) return [];

  await container.hunters.update({
    gold: hunter.gold + outcome.goldAwarded,
  });

  const events: DomainEvent[] = [
    {
      type: "HiddenQuestRevealed",
      questId: SEVENTH_DAY.id,
      questName: SEVENTH_DAY.name,
      goldAwarded: makeGold(outcome.goldAwarded),
    },
    {
      type: "GoldGained",
      amount: makeGold(outcome.goldAwarded),
      source: "hidden-quest",
    },
  ];
  await container.events.record(events, today, now);
  return events;
}
