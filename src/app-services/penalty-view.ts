import {
  daysBetween,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  dailyQuestTargets,
  isQuestComplete,
  questCompletionPercent,
  type QuestProgress,
  type QuestTargets,
} from "@/core/quest/daily-quest";
import { isSystemSilent, survivalTargets } from "@/core/penalty/penalty";
import {
  penaltyVariantFor,
  type PenaltyVariant,
} from "@/core/penalty/variants";
import { rankForLevel } from "@/core/hunter/progression";
import type { Container } from "@/server/container";
import { ensureDailyQuest } from "./ensure-daily-quest";

/** A hunter who has not trained in this many days gets the way back in. */
export const DORMANT_DAYS_FOR_REAWAKENING = 14;

export type PenaltyView = {
  penaltyId: string;
  day: string;
  variant: PenaltyVariant;
  daysStuck: number;
  systemSilent: boolean;
  reawakening: boolean;
  targets: QuestTargets;
  progress: QuestProgress;
  percent: number;
  canEscape: boolean;
};

export async function getPenaltyView(
  container: Container,
): Promise<PenaltyView | null> {
  const active = await container.penalties.active();
  if (!active) return null;

  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const daysStuck = Math.max(
    0,
    daysBetween(active.startedDay as TrainingDay, today),
  );

  const lastActivity = await container.training.lastActivityDay();
  const dormantDays =
    lastActivity === null
      ? daysStuck
      : daysBetween(lastActivity as TrainingDay, today);
  const reawakening = dormantDays >= DORMANT_DAYS_FOR_REAWAKENING;

  const base = dailyQuestTargets(rankForLevel(hunter.level));
  // A returning hunter is handed the base quest, not the escalated debt.
  const targets = reawakening ? base : survivalTargets(base, daysStuck);

  const ensured = await ensureDailyQuest(container, today);
  const quest = ensured.ok ? ensured.value : null;
  const progress: QuestProgress = {
    pushups: quest?.progressPushups ?? 0,
    situps: quest?.progressSitups ?? 0,
    squats: quest?.progressSquats ?? 0,
    runKm: await container.training.kmOnDay(today),
  };

  return {
    penaltyId: active.id,
    day: today,
    variant: penaltyVariantFor(active.variantId - 1),
    daysStuck,
    systemSilent: isSystemSilent(daysStuck),
    reawakening,
    targets,
    progress,
    percent: questCompletionPercent(targets, progress),
    canEscape: isQuestComplete(targets, progress),
  };
}
