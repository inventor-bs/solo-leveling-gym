import { describe, it, expect } from "vitest";
import { parseTrainingDay } from "@/core/shared/training-day";
import { currentStreak, type QuestOutcome } from "./streak";

const day = (s: string) => parseTrainingDay(s);

function outcomes(
  entries: readonly (readonly [string, boolean])[],
): QuestOutcome[] {
  return entries.map(([d, completed]) => ({ day: day(d), completed }));
}

describe("currentStreak", () => {
  it("is 0 with no history at all", () => {
    expect(currentStreak([], day("2026-08-06"))).toBe(0);
  });

  it("counts consecutive completed days ending today", () => {
    const history = outcomes([
      ["2026-08-04", true],
      ["2026-08-05", true],
      ["2026-08-06", true],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(3);
  });

  it("REGRESSION: today still pending does not zero a live streak", () => {
    // The most common real state: it is 09:00 and today's quest is untouched.
    // Yesterday's streak must survive until the day actually ends.
    const history = outcomes([
      ["2026-08-04", true],
      ["2026-08-05", true],
      ["2026-08-06", false],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(2);
  });

  it("treats a day with no row at all the same as a pending day", () => {
    const history = outcomes([
      ["2026-08-04", true],
      ["2026-08-05", true],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(2);
  });

  it("stops at the first missed day", () => {
    const history = outcomes([
      ["2026-08-02", true],
      ["2026-08-03", false],
      ["2026-08-04", true],
      ["2026-08-05", true],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(2);
  });

  it("is 0 when yesterday was missed and today is not done", () => {
    const history = outcomes([
      ["2026-08-04", true],
      ["2026-08-05", false],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(0);
  });

  it("is 1 when yesterday was missed but today is already done", () => {
    const history = outcomes([
      ["2026-08-05", false],
      ["2026-08-06", true],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(1);
  });

  it("crosses a month boundary", () => {
    const history = outcomes([
      ["2026-07-30", true],
      ["2026-07-31", true],
      ["2026-08-01", true],
    ]);
    expect(currentStreak(history, day("2026-08-01"))).toBe(3);
  });

  it("does not care about the order rows arrive in", () => {
    const history = outcomes([
      ["2026-08-06", true],
      ["2026-08-04", true],
      ["2026-08-05", true],
    ]);
    expect(currentStreak(history, day("2026-08-06"))).toBe(3);
  });
});
