import type { DomainEvent } from "@/core/shared/events";
import { epoch, gold as makeGold } from "@/core/shared/units";
import {
  addDays,
  daysBetween,
  localHourOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  evaluateSeventhDay,
  SEVENTH_DAY,
  SEVENTH_DAY_WINDOW_DAYS,
  evaluateFiveDayStreak,
  FIVE_DAY_STREAK,
  evaluateFirstRecord,
  FIRST_RECORD,
  evaluateEarlyRiser,
  EARLY_RISER,
} from "@/core/quest/hidden-quest";
import { currentStreak } from "@/core/quest/streak";
import { MORNING_BEFORE_HOUR } from "@/core/title/catalog";
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
 * Reveals one hidden quest if its condition is met and it has never been
 * revealed before, persisting the reveal and paying the gold immediately.
 *
 * Each of the four hidden quests calls this independently rather than
 * sharing one persistence step at the end of the function — so a later
 * quest throwing partway through never rolls back or blocks an earlier
 * quest's reveal in the same call.
 */
async function revealOne(
  container: Container,
  id: string,
  name: string,
  today: TrainingDay,
  now: number,
  outcome: { revealed: boolean; goldAwarded: number },
): Promise<DomainEvent[]> {
  if (!outcome.revealed) return [];
  if (await container.hiddenQuests.byId(id)) return [];

  const hunter = await container.hunters.get();
  if (!hunter) return [];

  const won = await container.hiddenQuests.reveal({
    id,
    name,
    revealedDay: today,
    revealedAt: now,
    goldAwarded: outcome.goldAwarded,
  });
  if (!won) return [];

  await container.hunters.update({ gold: hunter.gold + outcome.goldAwarded });

  const events: DomainEvent[] = [
    {
      type: "HiddenQuestRevealed",
      questId: id,
      questName: name,
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

/**
 * Surfaces every hidden quest whose condition has quietly become true.
 *
 * Each of the four is evaluated and persisted independently through
 * `revealOne` — one quest's reveal must never be lost or delayed because
 * another in the same call throws or was already revealed. A caller that
 * has events of its own from the same request must not write these a
 * second time; they are already persisted by the time this returns.
 */
export async function revealHiddenQuests(
  container: Container,
): Promise<DomainEvent[]> {
  const hunter = await container.hunters.get();
  if (!hunter) return [];

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  const startDay = toTrainingDay(
    epoch(hunter.createdAt),
    container.tzOffsetMinutes,
  );
  // Inclusive window: registration day plus the six that follow.
  const windowEnd = addDays(startDay, SEVENTH_DAY_WINDOW_DAYS - 1);

  const events: DomainEvent[] = [];

  events.push(
    ...(await revealOne(
      container,
      SEVENTH_DAY.id,
      SEVENTH_DAY.name,
      today,
      now,
      evaluateSeventhDay({
        daysSinceStart: daysBetween(startDay, today),
        activeDays: await countActiveDays(container, startDay, windowEnd),
      }),
    )),
  );

  const outcomes = await container.quests.recentOutcomes(400);
  const streakDays = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    today,
  );
  const equippedSkills = new Set(await container.skills.equippedIds());
  events.push(
    ...(await revealOne(
      container,
      FIVE_DAY_STREAK.id,
      FIVE_DAY_STREAK.name,
      today,
      now,
      evaluateFiveDayStreak({
        streakDays,
        stealthEquipped: equippedSkills.has("stealth"),
      }),
    )),
  );

  const prCountEver = await container.events.countByType("PrAchieved");
  events.push(
    ...(await revealOne(
      container,
      FIRST_RECORD.id,
      FIRST_RECORD.name,
      today,
      now,
      evaluateFirstRecord({ prCountEver }),
    )),
  );

  // Local hour, not UTC: a 06:30 session in Vietnam is logged at 23:30 UTC
  // the previous day, and reading the raw hour would classify it as 23:00.
  const starts = await container.training.completedSessionStarts();
  const hasEarlySession = starts.some(
    (at) =>
      localHourOf(epoch(at), container.tzOffsetMinutes) < MORNING_BEFORE_HOUR,
  );
  events.push(
    ...(await revealOne(
      container,
      EARLY_RISER.id,
      EARLY_RISER.name,
      today,
      now,
      evaluateEarlyRiser({ hasEarlySession }),
    )),
  );

  return events;
}
