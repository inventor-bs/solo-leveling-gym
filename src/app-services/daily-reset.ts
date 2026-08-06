import type { DomainEvent } from "@/core/shared/events";
import { addDays, toTrainingDay } from "@/core/shared/training-day";
import { isQuestComplete } from "@/core/quest/daily-quest";
import type { QuestStatus } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { enterPenalty } from "./enter-penalty";

export type DailyResetSummary = {
  today: string;
  yesterday: string;
  yesterdayStatus: QuestStatus | "none" | "skipped-penalty-active";
  issuedToday: boolean;
  penaltyOpened: boolean;
  events: DomainEvent[];
};

/**
 * Closes the book on yesterday, then opens today.
 *
 * Judging happens first so a quest can never be issued for a day whose
 * predecessor is still unresolved. Both halves are idempotent, because a
 * cron that retries must not punish twice.
 */
export async function runDailyReset(
  container: Container,
): Promise<DailyResetSummary> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const yesterday = addDays(today, -1);
  const events: DomainEvent[] = [];

  // No punishment stacks on a punishment. While an episode is open the quest
  // is left unjudged entirely, so the debt stays at exactly one Survival Quest
  // however long the hunter is stuck.
  const activePenalty = await container.penalties.active();
  if (activePenalty) {
    const alreadyIssued = (await container.quests.byDay(today)) !== null;
    await ensureDailyQuest(container, today);
    return {
      today,
      yesterday,
      yesterdayStatus: "skipped-penalty-active",
      issuedToday: !alreadyIssued,
      penaltyOpened: false,
      events,
    };
  }

  let yesterdayStatus: QuestStatus | "none" | "skipped-penalty-active" = "none";
  let penaltyOpened = false;
  const previous = await container.quests.byDay(yesterday);

  if (previous) {
    if (previous.status !== "active") {
      // Already judged on an earlier run — leave it exactly as it is.
      yesterdayStatus = previous.status as QuestStatus;
    } else {
      const runKm = await container.training.kmOnDay(yesterday);
      const complete = isQuestComplete(
        {
          pushups: previous.targetPushups,
          situps: previous.targetSitups,
          squats: previous.targetSquats,
          runKm: previous.targetRunKm,
        },
        {
          pushups: previous.progressPushups,
          situps: previous.progressSitups,
          squats: previous.progressSquats,
          runKm,
        },
      );
      yesterdayStatus = complete ? "completed" : "missed";
      await container.quests.setStatus(
        yesterday,
        yesterdayStatus,
        container.clock.now(),
      );
      events.push(
        complete
          ? { type: "DailyQuestCompleted", day: yesterday, streak: 0 }
          : { type: "DailyQuestMissed", day: yesterday },
      );

      if (!complete) {
        const opened = await enterPenalty(container, yesterday);
        if (opened.ok) {
          penaltyOpened = true;
          events.push(...opened.value.events);
        }
      }
    }
  }

  const alreadyIssued = (await container.quests.byDay(today)) !== null;
  await ensureDailyQuest(container, today);

  return {
    today,
    yesterday,
    yesterdayStatus,
    issuedToday: !alreadyIssued,
    penaltyOpened,
    events,
  };
}
