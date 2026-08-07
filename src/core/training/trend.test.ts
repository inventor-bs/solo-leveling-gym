import { describe, it, expect } from "vitest";
import { parseTrainingDay } from "@/core/shared/training-day";
import { liftTrend, TREND_WINDOW_DAYS, type E1rmPoint } from "./trend";

const today = parseTrainingDay("2026-08-07");

function point(day: string, e1rm: number): E1rmPoint {
  return { day: parseTrainingDay(day), e1rm };
}

describe("liftTrend", () => {
  it("uses a 28-day window", () => {
    expect(TREND_WINDOW_DAYS).toBe(28);
  });

  it("reports nothing at all for an exercise with no history", () => {
    expect(liftTrend([], today)).toEqual({
      current: null,
      previous: null,
      deltaKg: null,
      best: 0,
      bestDay: null,
    });
  });

  it("reports the current window only when there is no older history", () => {
    const trend = liftTrend([point("2026-08-06", 100)], today);
    expect(trend.current).toBe(100);
    expect(trend.previous).toBeNull();
    expect(trend.deltaKg).toBeNull();
    expect(trend.best).toBe(100);
    expect(trend.bestDay).toBe("2026-08-06");
  });

  it("takes the heaviest lift inside each window, not the latest", () => {
    const trend = liftTrend(
      [
        point("2026-08-06", 95),
        point("2026-07-25", 102.5),
        point("2026-07-05", 90),
        point("2026-06-20", 85),
      ],
      today,
    );
    expect(trend.current).toBe(102.5); // 2026-07-25 is inside the last 28 days
    expect(trend.previous).toBe(90); // 2026-07-05 is inside the 28 before that
    expect(trend.deltaKg).toBe(12.5);
  });

  it("REGRESSION: shows a negative delta when the lift went backwards", () => {
    // Comparing all-time best against all-time best could never do this,
    // and a table that cannot show detraining is not telling the truth.
    const trend = liftTrend(
      [point("2026-08-01", 80), point("2026-07-04", 100)],
      today,
    );
    expect(trend.current).toBe(80);
    expect(trend.previous).toBe(100);
    expect(trend.deltaKg).toBe(-20);
  });

  it("counts history older than both windows toward the all-time PR only", () => {
    const trend = liftTrend(
      [point("2026-08-06", 90), point("2025-01-01", 140)],
      today,
    );
    expect(trend.current).toBe(90);
    expect(trend.previous).toBeNull();
    expect(trend.best).toBe(140);
    expect(trend.bestDay).toBe("2025-01-01");
  });

  it("REGRESSION: a PR matched again later keeps the day it was first set", () => {
    // The PR row answers 'when did this happen', so a tie must not steal
    // the date. History arrives newest-first from the repository, so this
    // only holds if the comparison prefers the earlier day explicitly.
    const trend = liftTrend(
      [point("2026-08-06", 120), point("2026-06-01", 120)],
      today,
    );
    expect(trend.best).toBe(120);
    expect(trend.bestDay).toBe("2026-06-01");
  });

  it("includes today itself in the current window", () => {
    const trend = liftTrend([point("2026-08-07", 110)], today);
    expect(trend.current).toBe(110);
  });

  it("puts the 28th day back in the current window and the 29th in the previous one", () => {
    // today - 27 is the oldest day still inside the current window.
    const boundary = liftTrend([point("2026-07-11", 100)], today);
    expect(boundary.current).toBe(100);
    expect(boundary.previous).toBeNull();

    const justOutside = liftTrend([point("2026-07-10", 100)], today);
    expect(justOutside.current).toBeNull();
    expect(justOutside.previous).toBe(100);
  });
});
