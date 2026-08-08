import type { DomainEvent } from "@/core/shared/events";
import { addDays, toTrainingDay } from "@/core/shared/training-day";
import { isQuestComplete } from "@/core/quest/daily-quest";
import type { QuestStatus } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { ensureNarrativeUnlocks } from "./ensure-narrative";
import { enterPenalty } from "./enter-penalty";

export type DailyResetSummary = {
  today: string;
  yesterday: string;
  yesterdayStatus: QuestStatus | "none" | "skipped-penalty-active";
  issuedToday: boolean;
  penaltyOpened: boolean;
  fragmentsUnlocked: number;
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
  // Only events this function creates itself go here. A sub-call such as
  // enterPenalty persists its own events before returning them, so folding
  // its events into `events` (for the full picture returned to the caller)
  // must not also fold them into what gets persisted below — that would
  // write the same row twice.
  const eventsToPersist: DomainEvent[] = [];

  /**
   * Milestone work that must run on EVERY reset, including days the quest
   * is left unjudged because a penalty episode is open. The story is not a
   * reward and must not be withheld by the Penalty Zone.
   *
   * These sub-calls persist their own events, so their results are folded
   * into `events` for the caller's benefit but never into `eventsToPersist`
   * — that would write each row twice.
   */
  let fragmentsUnlocked = 0;
  const runMilestones = async (): Promise<void> => {
    const narrativeEvents = await ensureNarrativeUnlocks(container);
    fragmentsUnlocked = narrativeEvents.length;
    events.push(...narrativeEvents);
  };

  // No punishment stacks on a punishment. While an episode is open the quest
  // is left unjudged entirely, so the debt stays at exactly one Survival Quest
  // however long the hunter is stuck.
  const activePenalty = await container.penalties.active();
  if (activePenalty) {
    const alreadyIssued = (await container.quests.byDay(today)) !== null;
    await ensureDailyQuest(container, today);
    await runMilestones();
    return {
      today,
      yesterday,
      yesterdayStatus: "skipped-penalty-active",
      issuedToday: !alreadyIssued,
      penaltyOpened: false,
      fragmentsUnlocked,
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
      const judgmentEvent: DomainEvent = complete
        ? { type: "DailyQuestCompleted", day: yesterday, streak: 0 }
        : { type: "DailyQuestMissed", day: yesterday };
      events.push(judgmentEvent);
      eventsToPersist.push(judgmentEvent);

      if (!complete) {
        const opened = await enterPenalty(container, yesterday);
        if (opened.ok) {
          penaltyOpened = true;
          // enterPenalty already persisted its own events (see
          // enter-penalty.ts) — fold them into the returned list for the
          // caller, but not into eventsToPersist, or they'd be written twice.
          events.push(...opened.value.events);
        }
      }
    }
  }

  const alreadyIssued = (await container.quests.byDay(today)) !== null;
  await ensureDailyQuest(container, today);

  await container.events.record(
    eventsToPersist,
    yesterday,
    container.clock.now(),
  );

  await runMilestones();

  return {
    today,
    yesterday,
    yesterdayStatus,
    issuedToday: !alreadyIssued,
    penaltyOpened,
    fragmentsUnlocked,
    events,
  };
}
