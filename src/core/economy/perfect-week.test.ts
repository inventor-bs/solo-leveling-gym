import { describe, it, expect } from "vitest";
import { isPerfectWeek, type PerfectWeekInput } from "./perfect-week";

function week(overrides: Partial<PerfectWeekInput> = {}): PerfectWeekInput {
  return {
    scheduledDays: ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-08"],
    trainedDays: ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-08"],
    questsIssued: 7,
    questsCompleted: 7,
    penaltiesStarted: 0,
    ...overrides,
  };
}

describe("isPerfectWeek", () => {
  it("is perfect when every scheduled day was trained, every quest cleared, and no penalty opened", () => {
    expect(isPerfectWeek(week())).toBe(true);
  });

  it("tolerates training on a day the program did not schedule", () => {
    expect(
      isPerfectWeek(
        week({ trainedDays: [...week().trainedDays, "2026-08-04"] }),
      ),
    ).toBe(true);
  });

  it("fails when one scheduled day went untrained", () => {
    expect(
      isPerfectWeek(
        week({ trainedDays: ["2026-08-03", "2026-08-05", "2026-08-07"] }),
      ),
    ).toBe(false);
  });

  it("fails when a scheduled day was trained on a different day of the week", () => {
    expect(
      isPerfectWeek(
        week({
          trainedDays: ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-09"],
        }),
      ),
    ).toBe(false);
  });

  it("fails when a single issued quest went unfinished", () => {
    expect(isPerfectWeek(week({ questsCompleted: 6 }))).toBe(false);
  });

  it("fails when a penalty opened inside the week", () => {
    expect(isPerfectWeek(week({ penaltiesStarted: 1 }))).toBe(false);
  });

  it("is never perfect when the program scheduled nothing at all", () => {
    // A week with no obligations is not an achievement. Without this, an
    // empty program would pay 500 gold every Monday forever.
    expect(
      isPerfectWeek(
        week({
          scheduledDays: [],
          trainedDays: [],
          questsIssued: 0,
          questsCompleted: 0,
        }),
      ),
    ).toBe(false);
  });

  it("is never perfect when no quest was ever issued", () => {
    expect(isPerfectWeek(week({ questsIssued: 0, questsCompleted: 0 }))).toBe(
      false,
    );
  });
});
