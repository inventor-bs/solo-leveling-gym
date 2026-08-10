import type { DomainEvent } from "@/core/shared/events";
import { parseTrainingDay, toTrainingDay } from "@/core/shared/training-day";
import { isQuestComplete } from "@/core/quest/daily-quest";
import type { QuestStatus } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";
import { enterPenalty } from "./enter-penalty";
import { runWeeklyEconomyChecks } from "./daily-reset";

export type GraceResetSummary = {
  today: string;
  judged: { day: string; status: QuestStatus }[];
  penaltyOpened: boolean;
  events: DomainEvent[];
};

/**
 * The second reset, four hours after the first.
 *
 * The 00:00 reset skips judgment for any day an Hourglass was bought for.
 * This picks those days up and decides them, which is what turns the item
 * into four extra hours rather than a pardon.
 *
 * "Not yet judged" needs no column: the quest is still `active`. Anything
 * already completed or missed is left exactly as it is, so re-running this
 * is a no-op.
 */
export async function runGraceReset(
  container: Container,
): Promise<GraceResetSummary> {
  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  const judged: { day: string; status: QuestStatus }[] = [];
  const events: DomainEvent[] = [];

  // No punishment stacks on a punishment, the same rule the 00:00 reset has
  // enforced since the Penalty Zone shipped. Days left unjudged here stay
  // active and will be picked up once the episode closes.
  if (await container.penalties.active()) {
    return { today, judged, penaltyOpened: false, events };
  }

  let penaltyOpened = false;

  // Only days that have actually ended. Today's grace window is still open.
  for (const grace of await container.mitigation.gracesBetween(
    "0000-01-01",
    today,
  )) {
    if (grace.day >= today) continue;

    const quest = await container.quests.byDay(grace.day);
    if (quest === null || quest.status !== "active") continue;

    const day = parseTrainingDay(grace.day);
    const runKm = await container.training.kmOnDay(day);
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

    const status: QuestStatus = complete ? "completed" : "missed";
    await container.quests.setStatus(day, status, now);
    judged.push({ day, status });

    const judgment: DomainEvent = complete
      ? { type: "DailyQuestCompleted", day, streak: 0 }
      : { type: "DailyQuestMissed", day };
    await container.events.record([judgment], day, now);
    events.push(judgment);

    if (!complete) {
      const opened = await enterPenalty(container, day);
      if (opened.ok) {
        penaltyOpened = true;
        // enterPenalty persists its own events — folded in for the caller,
        // never re-recorded here, or every row would be written twice.
        events.push(...opened.value.events);
        // One open episode is the whole debt however many days went wrong,
        // and enterPenalty would refuse a second anyway. Stop here so the
        // remaining days stay active for the next run.
        break;
      }
    }
  }

  // Runs after the judgment loop, so any day judged above is no longer
  // deferred by the time this reads it. The same Perfect Week and wager
  // checks the 00:00 reset runs, retried now with a final status for
  // whatever this loop just judged — see runWeeklyEconomyChecks' own doc
  // comment for why a deferred day must skip those checks in the first
  // place rather than count as "not completed".
  const weekly = await runWeeklyEconomyChecks(container, today);
  events.push(...weekly.events);

  return { today, judged, penaltyOpened, events };
}
