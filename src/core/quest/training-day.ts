import { epoch, type Epoch } from "@/core/shared/units";

declare const trainingDayBrand: unique symbol;

/**
 * The hunter's local calendar day, formatted as "YYYY-MM-DD".
 *
 * THIS IS THE ONLY PLACE in the entire codebase allowed to derive a
 * "day" from an instant. No other code may call getDate()/getMonth().
 *
 * The DB always stores UTC epoch. This type exists only at the logic layer.
 *
 * A fixed offset (minutes) is used instead of tzdata: Vietnam has no DST,
 * so UTC+7 is always correct, and this avoids pulling in a whole library.
 */
export type TrainingDay = string & {
  readonly [trainingDayBrand]: "TrainingDay";
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcParts(d: Date): TrainingDay {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}` as TrainingDay;
}

/** Reduces an instant to the hunter's local calendar day. */
export function toTrainingDay(at: Epoch, tzOffsetMinutes: number): TrainingDay {
  // Shift the instant to "local time expressed as UTC", then read its
  // UTC components. This sidesteps the server's own timezone entirely.
  return formatUtcParts(new Date(at + tzOffsetMinutes * MS_PER_MINUTE));
}

/** The instant at 00:00:00.000 local time on that day. */
export function trainingDayStart(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  const [y, m, d] = day.split("-").map(Number);
  return epoch(Date.UTC(y, m - 1, d) - tzOffsetMinutes * MS_PER_MINUTE);
}

/** The instant at 23:59:59.999 local time on that day. */
export function trainingDayEnd(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  return epoch(trainingDayStart(day, tzOffsetMinutes) + MS_PER_DAY - 1);
}

/** Adds (or subtracts, when n is negative) a number of calendar days. */
export function addDays(day: TrainingDay, n: number): TrainingDay {
  const [y, m, d] = day.split("-").map(Number);
  return formatUtcParts(new Date(Date.UTC(y, m - 1, d) + n * MS_PER_DAY));
}

/** Number of calendar days from `from` to `to`. Negative if `to` precedes `from`. */
export function daysBetween(from: TrainingDay, to: TrainingDay): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY,
  );
}
