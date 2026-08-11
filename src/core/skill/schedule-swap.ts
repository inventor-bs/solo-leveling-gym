export type WeeklySwap = {
  readonly weekStart: string;
  readonly weekdayFrom: number;
  readonly weekdayTo: number;
};

const WEEK_LENGTH_DAYS = 7;

/**
 * The base schedule with one weekday swapped for another, active only for
 * days that fall inside the swap's own week — a swap made for last week
 * must never leak into this one. `cursorDay` and `swap.weekStart` are both
 * `YYYY-MM-DD` strings, lexicographically comparable in that format.
 */
export function effectiveScheduledWeekdays(
  base: ReadonlySet<number>,
  swap: WeeklySwap | null,
  cursorDay: string,
): ReadonlySet<number> {
  if (!swap) return base;

  const weekEnd = addDaysToDateString(swap.weekStart, WEEK_LENGTH_DAYS - 1);
  if (cursorDay < swap.weekStart || cursorDay > weekEnd) return base;

  const result = new Set(base);
  result.delete(swap.weekdayFrom);
  result.add(swap.weekdayTo);
  return result;
}

function addDaysToDateString(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
