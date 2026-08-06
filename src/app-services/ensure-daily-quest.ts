import { ok, err, type Result } from "@/core/shared/result";
import type { TrainingDay } from "@/core/shared/training-day";
import { rankForLevel } from "@/core/hunter/progression";
import { dailyQuestTargets } from "@/core/quest/daily-quest";
import type { DailyQuestRow } from "@/infra/db/schema/quest";
import type { Container } from "@/server/container";

export type EnsureQuestError = { type: "hunter-not-found" };

/**
 * Issues today's quest if it does not exist yet, and returns it either way.
 *
 * Called by the daily cron AND by every page that shows the quest. Vercel
 * Hobby crons fire once a day and can be delayed; if one is late or never
 * configured, opening the app must still produce a quest rather than an
 * empty screen.
 */
export async function ensureDailyQuest(
  container: Container,
  day: TrainingDay,
): Promise<Result<DailyQuestRow, EnsureQuestError>> {
  const existing = await container.quests.byDay(day);
  if (existing) return ok(existing);

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  // Derived from level rather than the stored rank column, which only
  // updates on level-up and can therefore lag behind.
  const rank = rankForLevel(hunter.level);
  const targets = dailyQuestTargets(rank);

  const created = await container.quests.create({
    id: container.newId(),
    day,
    rank,
    targetPushups: targets.pushups,
    targetSitups: targets.situps,
    targetSquats: targets.squats,
    targetRunKm: targets.runKm,
    createdAt: container.clock.now(),
  });
  return ok(created);
}
