import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { gold as makeGold } from "@/core/shared/units";
import type { TrainingDay } from "@/core/shared/training-day";
import { isQuestComplete } from "@/core/quest/daily-quest";
import { currentStreak } from "@/core/quest/streak";
import {
  equipmentQuestGoldMultiplier,
  isEquipmentGrade,
} from "@/core/economy/equipment";
import type { DailyQuestRow } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";
import { awardEarnedTitles } from "./award-titles";

/** Fixed reward for clearing the day's quest. */
export const DAILY_QUEST_GOLD = 50;

export type LogQuestProgressInput = {
  day: TrainingDay;
  pushups?: number;
  situps?: number;
  squats?: number;
};

export type LogQuestProgressResult = {
  quest: DailyQuestRow;
  completed: boolean;
  streak: number;
  events: DomainEvent[];
};

export type LogQuestProgressError =
  { type: "quest-not-found" } | { type: "hunter-not-found" };

/** Progress only ever moves forward; a negative delta is dropped. */
function forward(n: number | undefined): number {
  return n !== undefined && n > 0 ? Math.floor(n) : 0;
}

export async function logQuestProgress(
  container: Container,
  input: LogQuestProgressInput,
): Promise<Result<LogQuestProgressResult, LogQuestProgressError>> {
  const existing = await container.quests.byDay(input.day);
  if (!existing) return err({ type: "quest-not-found" });

  await container.quests.addProgress(input.day, {
    pushups: forward(input.pushups),
    situps: forward(input.situps),
    squats: forward(input.squats),
  });

  const quest = await container.quests.byDay(input.day);
  if (!quest) return err({ type: "quest-not-found" });

  const runKm = await container.training.kmOnDay(input.day);
  const complete = isQuestComplete(
    {
      pushups: quest.targetPushups,
      situps: quest.targetSitups,
      squats: quest.targetSquats,
      runKm: quest.targetRunKm,
    },
    {
      pushups: quest.progressPushups,
      situps: quest.progressSitups,
      squats: quest.progressSquats,
      runKm,
    },
  );

  const now = container.clock.now();
  const events: DomainEvent[] = [
    { type: "QuestProgressLogged", day: input.day },
  ];

  // The status check is what makes the reward once-only: a quest already
  // marked completed never pays again, however many times this is called.
  const justCompleted = complete && quest.status !== "completed";
  if (justCompleted) {
    const hunter = await container.hunters.get();
    if (!hunter) return err({ type: "hunter-not-found" });

    // The accessory slot is Hunter's Charm and nothing else, so the slot
    // alone identifies the item. An unrecognised grade string is treated as
    // no item at all rather than trusted — the column is plain TEXT.
    const accessory = await container.equipment.bySlot("accessory");
    const accessoryGrade =
      accessory !== null && isEquipmentGrade(accessory.grade)
        ? accessory.grade
        : null;
    // Rounded to integer hundredths before multiplying: 50 * 1.15 evaluates
    // to 57.49999999999999 in floating point, one gold short of the correct
    // 58. Rounding the multiplier to a whole number of hundredths first and
    // dividing back down after the multiply keeps the arithmetic exact.
    const multiplierHundredths = Math.round(
      equipmentQuestGoldMultiplier(accessoryGrade) * 100,
    );
    const goldPaid = Math.round(
      (DAILY_QUEST_GOLD * multiplierHundredths) / 100,
    );

    await container.quests.setStatus(input.day, "completed", now);
    await container.hunters.update({ gold: hunter.gold + goldPaid });
    events.push({
      type: "GoldGained",
      amount: makeGold(goldPaid),
      source: "daily-quest",
    });
  }

  const outcomes = await container.quests.recentOutcomes(60);
  const streak = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    input.day,
  );

  if (justCompleted) {
    events.push({
      type: "DailyQuestCompleted",
      day: input.day,
      streak,
    });
    // Only on completion: a streak can only move when a quest closes, and
    // a rep-by-rep tap should not pay for three extra queries.
    events.push(...(await awardEarnedTitles(container)));
  }

  const finalQuest = await container.quests.byDay(input.day);
  if (!finalQuest) return err({ type: "quest-not-found" });

  await container.events.record(events, input.day, now);

  return ok({ quest: finalQuest, completed: complete, streak, events });
}
