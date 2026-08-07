import { describe, it, expect } from "vitest";
import { earnedTitleIds, type TitleProgress } from "./earning";

function progress(patch: Partial<TitleProgress> = {}): TitleProgress {
  return { streakDays: 0, morningSessions: 0, penaltyExits: 0, ...patch };
}

describe("earnedTitleIds", () => {
  it("earns nothing from a hunter who has done nothing", () => {
    expect(earnedTitleIds(progress())).toEqual([]);
  });

  it("earns Unyielding at exactly 30 streak days, not at 29", () => {
    expect(earnedTitleIds(progress({ streakDays: 29 }))).toEqual([]);
    expect(earnedTitleIds(progress({ streakDays: 30 }))).toEqual([
      "unyielding",
    ]);
  });

  it("earns Monarch of Dawn at exactly 10 morning sessions, not at 9", () => {
    expect(earnedTitleIds(progress({ morningSessions: 9 }))).toEqual([]);
    expect(earnedTitleIds(progress({ morningSessions: 10 }))).toEqual([
      "monarch-of-dawn",
    ]);
  });

  it("earns One Who Returned at exactly 5 penalty exits, not at 4", () => {
    expect(earnedTitleIds(progress({ penaltyExits: 4 }))).toEqual([]);
    expect(earnedTitleIds(progress({ penaltyExits: 5 }))).toEqual([
      "one-who-returned",
    ]);
  });

  it("reports every condition that is met, in catalog order", () => {
    expect(
      earnedTitleIds(
        progress({ streakDays: 41, morningSessions: 12, penaltyExits: 6 }),
      ),
    ).toEqual(["unyielding", "monarch-of-dawn", "one-who-returned"]);
  });

  it("REGRESSION: reports only what the numbers currently show — it never remembers", () => {
    // Earning is one-way, but that memory is the caller's stored earnedAt,
    // not this function's job. A broken streak must still read as unmet here,
    // otherwise the two responsibilities blur and the stored timestamp stops
    // being the single source of truth.
    expect(earnedTitleIds(progress({ streakDays: 0 }))).toEqual([]);
  });
});
