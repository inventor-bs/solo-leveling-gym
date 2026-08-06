import { ok, type Result } from "@/core/shared/result";
import { toTrainingDay, type TrainingDay } from "@/core/shared/training-day";
import {
  isQuestComplete,
  questCompletionPercent,
  type QuestProgress,
  type QuestTargets,
} from "@/core/quest/daily-quest";
import { currentStreak } from "@/core/quest/streak";
import type { Container } from "@/server/container";
import { ensureDailyQuest, type EnsureQuestError } from "./ensure-daily-quest";

export type QuestView = {
  day: string;
  rank: string;
  targets: QuestTargets;
  progress: QuestProgress;
  percent: number;
  complete: boolean;
  streak: number;
};

export async function getQuestView(
  container: Container,
): Promise<Result<QuestView, EnsureQuestError>> {
  const day = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);

  const ensured = await ensureDailyQuest(container, day);
  if (!ensured.ok) return ensured;
  const quest = ensured.value;

  const targets: QuestTargets = {
    pushups: quest.targetPushups,
    situps: quest.targetSitups,
    squats: quest.targetSquats,
    runKm: quest.targetRunKm,
  };
  const progress: QuestProgress = {
    pushups: quest.progressPushups,
    situps: quest.progressSitups,
    squats: quest.progressSquats,
    runKm: await container.training.kmOnDay(day),
  };

  const outcomes = await container.quests.recentOutcomes(60);
  const streak = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    day,
  );

  return ok({
    day,
    rank: quest.rank,
    targets,
    progress,
    percent: questCompletionPercent(targets, progress),
    complete: isQuestComplete(targets, progress),
    streak,
  });
}
