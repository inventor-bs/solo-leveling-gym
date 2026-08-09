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
 *
 * The brand is a compile-time guarantee only. Values crossing a runtime
 * boundary (DB rows, JSON payloads, URL params) must go through
 * `parseTrainingDay` — never a bare cast.
 */
export type TrainingDay = string & {
  readonly [trainingDayBrand]: "TrainingDay";
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Strict YYYY-MM-DD. Rejects "2026-8-5", "26-08-05", trailing text. */
const TRAINING_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidTrainingDayError extends Error {
  constructor(value: string) {
    super(
      `Invalid TrainingDay: ${JSON.stringify(value)} (expected YYYY-MM-DD)`,
    );
    this.name = "InvalidTrainingDayError";
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcParts(d: Date): TrainingDay {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}` as TrainingDay;
}

type DayParts = { year: number; month: number; day: number };

/**
 * The single parsing choke point. Every function below goes through this,
 * so a malformed day can never reach date arithmetic and silently become NaN.
 */
function partsOf(day: TrainingDay): DayParts {
  const match = TRAINING_DAY_PATTERN.exec(day);
  if (match === null) throw new InvalidTrainingDayError(day);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayOfMonth = Number(match[3]);

  // Reject calendar-invalid dates the regex can't catch: month 13, Feb 30.
  // Round-tripping through Date.UTC is the cheapest correct check —
  // Date normalises overflow, so a mismatch means the input was invalid.
  const asUtc = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== dayOfMonth
  ) {
    throw new InvalidTrainingDayError(day);
  }

  return { year, month, day: dayOfMonth };
}

/** True when `value` is a well-formed, calendar-valid YYYY-MM-DD. */
export function isTrainingDay(value: string): value is TrainingDay {
  try {
    partsOf(value as TrainingDay);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates an untrusted string into a TrainingDay.
 * Use this at every runtime boundary. Throws on malformed input.
 */
export function parseTrainingDay(value: string): TrainingDay {
  partsOf(value as TrainingDay);
  return value as TrainingDay;
}

/** Reduces an instant to the hunter's local calendar day. */
export function toTrainingDay(at: Epoch, tzOffsetMinutes: number): TrainingDay {
  // Shift the instant to "local time expressed as UTC", then read its
  // UTC components. This sidesteps the server's own timezone entirely.
  return formatUtcParts(new Date(at + tzOffsetMinutes * MS_PER_MINUTE));
}

/**
 * Hour of day, 0-23, in the hunter's local time.
 *
 * Lives here for the same reason toTrainingDay does: this is the only file
 * allowed to turn an instant into a local calendar fact. The server runs
 * UTC and the hunter does not, so reading a raw UTC hour would classify a
 * 06:30 local session as 23:00 the day before.
 */
export function localHourOf(at: Epoch, tzOffsetMinutes: number): number {
  return new Date(at + tzOffsetMinutes * MS_PER_MINUTE).getUTCHours();
}

/** The instant at 00:00:00.000 local time on that day. */
export function trainingDayStart(
  day: TrainingDay,
  tzOffsetMinutes: number,
): Epoch {
  const { year, month, day: d } = partsOf(day);
  return epoch(Date.UTC(year, month - 1, d) - tzOffsetMinutes * MS_PER_MINUTE);
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
  const { year, month, day: d } = partsOf(day);
  return formatUtcParts(
    new Date(Date.UTC(year, month - 1, d) + n * MS_PER_DAY),
  );
}

/** Number of calendar days from `from` to `to`. Negative if `to` precedes `from`. */
export function daysBetween(from: TrainingDay, to: TrainingDay): number {
  const a = partsOf(from);
  const b = partsOf(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      MS_PER_DAY,
  );
}

/** ISO weekday, 1 = Monday through 7 = Sunday. */
export function isoWeekdayOf(day: TrainingDay): number {
  const { year, month, day: d } = partsOf(day);
  const jsDay = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * The Monday that opens the ISO week containing `day`.
 *
 * Lives here rather than at the call site for the same reason every other
 * calendar derivation does: a week boundary is a calendar fact about the
 * hunter's local time, and this file is the only one allowed to produce
 * one. Both the Perfect Week check and the weekly wager depend on the
 * caller and the cron agreeing on exactly which Monday a week starts on.
 *
 * Malformed input throws through partsOf, so a bad day can never silently
 * become a week that does not exist.
 */
export function startOfIsoWeek(day: TrainingDay): TrainingDay {
  return addDays(day, -(isoWeekdayOf(day) - 1));
}
