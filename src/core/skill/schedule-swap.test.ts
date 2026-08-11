import { describe, it, expect } from "vitest";
import { effectiveScheduledWeekdays } from "./schedule-swap";

describe("effectiveScheduledWeekdays", () => {
  const base = new Set([1, 3, 5, 6]); // Mon/Wed/Fri/Sat, this program's schedule

  it("returns the base set unchanged when there is no active swap", () => {
    expect(effectiveScheduledWeekdays(base, null, "2026-08-10")).toEqual(base);
  });

  it("removes weekdayFrom and adds weekdayTo for a day inside the swap's week", () => {
    const swap = { weekStart: "2026-08-10", weekdayFrom: 1, weekdayTo: 2 };
    const result = effectiveScheduledWeekdays(base, swap, "2026-08-11");
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
    expect(result).toEqual(new Set([2, 3, 5, 6]));
  });

  it("does not apply the swap to a day outside its week", () => {
    const swap = { weekStart: "2026-08-10", weekdayFrom: 1, weekdayTo: 2 };
    const result = effectiveScheduledWeekdays(base, swap, "2026-08-20");
    expect(result).toEqual(base);
  });
});
