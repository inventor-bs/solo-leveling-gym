import { ok, err, type Result } from "@/core/shared/result";
import { startOfIsoWeek, toTrainingDay } from "@/core/shared/training-day";
import type { Container } from "@/server/container";

export type SwapWeeklyScheduleResult = { weekStart: string };

export type SwapWeeklyScheduleError =
  { type: "skill-not-equipped" } | { type: "already-swapped-this-week" };

/**
 * Shadow Exchange: trades one of this week's scheduled weekdays for
 * another, once per ISO week. Only the swap row is written — the global
 * `program_day` schedule never changes, so every other week is unaffected.
 */
export async function swapWeeklySchedule(
  container: Container,
  weekdayFrom: number,
  weekdayTo: number,
): Promise<Result<SwapWeeklyScheduleResult, SwapWeeklyScheduleError>> {
  const equippedSkills = new Set(await container.skills.equippedIds());
  if (!equippedSkills.has("shadow-exchange")) {
    return err({ type: "skill-not-equipped" });
  }

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const weekStart = startOfIsoWeek(today);

  const existing = await container.skills.swapForWeek(weekStart);
  if (existing) return err({ type: "already-swapped-this-week" });

  await container.skills.recordSwap(
    weekStart,
    weekdayFrom,
    weekdayTo,
    container.clock.now(),
  );
  return ok({ weekStart });
}
