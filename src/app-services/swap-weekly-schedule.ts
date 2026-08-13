import { ok, err, type Result } from "@/core/shared/result";
import { startOfIsoWeek, toTrainingDay } from "@/core/shared/training-day";
import type { Container } from "@/server/container";

export type SwapWeeklyScheduleResult = { weekStart: string };

export type SwapWeeklyScheduleError =
  | { type: "skill-not-equipped" }
  | { type: "already-swapped-this-week" }
  | { type: "weekday-from-not-scheduled" }
  | { type: "weekday-to-already-scheduled" };

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

  // This is a move, not a delete: swapping a scheduled day onto another day
  // that is already scheduled would collapse the week by one training day
  // (effectiveScheduledWeekdays deletes weekdayFrom, then adds weekdayTo —
  // a no-op add when weekdayTo is already present). Validating against the
  // real base schedule also rules out swapping a day that was never
  // scheduled in the first place.
  const scheduled = await container.programs.allDays();
  const baseWeekdays = new Set(scheduled.map((d) => d.weekday));
  if (!baseWeekdays.has(weekdayFrom)) {
    return err({ type: "weekday-from-not-scheduled" });
  }
  if (baseWeekdays.has(weekdayTo)) {
    return err({ type: "weekday-to-already-scheduled" });
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
