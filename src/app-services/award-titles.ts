import { epoch } from "@/core/shared/units";
import {
  localHourOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { currentStreak } from "@/core/quest/streak";
import { earnedTitleIds } from "@/core/title/earning";
import { MORNING_BEFORE_HOUR } from "@/core/title/catalog";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

/**
 * Generous enough that a very long streak is never truncated by the query
 * limit — Unyielding needs 30 consecutive days, and a hunter who has held
 * one for a year should still read as holding one.
 */
const QUEST_HISTORY_DAYS = 400;

/**
 * Re-checks every title condition and permanently records the ones now met.
 *
 * Deliberately checks ALL of them on every call rather than one condition
 * per trigger. The three write paths that can move a condition — a quest
 * completing, a session completing, a penalty ending — each call this, so a
 * title whose exact moment was missed (an interrupted request, a corrected
 * row) is picked up by the next write instead of being lost forever.
 *
 * Safe to call repeatedly: TitleRepo.earn only writes when earnedAt is null,
 * so the returned event fires exactly once per title.
 */
export async function awardEarnedTitles(
  container: Container,
): Promise<DomainEvent[]> {
  const rows = await container.titles.all();
  if (rows.length === 0) return [];

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);

  const outcomes = await container.quests.recentOutcomes(QUEST_HISTORY_DAYS);
  const streakDays = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    today,
  );

  // Local hour, not UTC: a 06:30 session in Vietnam is logged at 23:30 UTC
  // the previous day, and reading the raw hour would classify it as 23:00.
  const starts = await container.training.completedSessionStarts();
  const morningSessions = starts.filter(
    (at) =>
      localHourOf(epoch(at), container.tzOffsetMinutes) < MORNING_BEFORE_HOUR,
  ).length;

  const penaltyExits = await container.penalties.countExited();

  const now = container.clock.now();
  const events: DomainEvent[] = [];
  for (const id of earnedTitleIds({
    streakDays,
    morningSessions,
    penaltyExits,
  })) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.earnedAt !== null) continue;
    await container.titles.earn(id, now);
    events.push({ type: "TitleEarned", titleId: row.id, titleName: row.name });
  }
  return events;
}
