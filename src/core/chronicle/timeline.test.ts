import { describe, it, expect } from "vitest";
import { toTimelineEntries, type RawEvent } from "./timeline";

function raw(
  type: string,
  day: string,
  occurredAt: number,
  payload: unknown,
): RawEvent {
  return { type, day, occurredAt, payload };
}

describe("toTimelineEntries", () => {
  it("turns a ShadowArisen event into an ARISE entry", () => {
    const entries = toTimelineEntries([
      raw("ShadowArisen", "2026-08-05", 1, {
        shadowId: "iron",
        shadowName: "Iron",
      }),
    ]);
    expect(entries).toEqual([
      {
        kind: "arise",
        day: "2026-08-05",
        occurredAt: 1,
        summary: "Iron has answered your call",
      },
    ]);
  });

  it("turns a PrAchieved event into a PR entry, resolving the exercise name from the lookup", () => {
    const entries = toTimelineEntries(
      [
        raw("PrAchieved", "2026-08-05", 1, {
          exerciseId: "bench-press",
          newE1rm: 82.5,
          previousE1rm: 75,
        }),
      ],
      new Map([["bench-press", "Bench Press"]]),
    );
    expect(entries).toEqual([
      {
        kind: "pr",
        day: "2026-08-05",
        occurredAt: 1,
        summary: "Bench Press 82.5 kg",
      },
    ]);
  });

  it("turns a PenaltyStarted event into a PENALTY ZONE entry", () => {
    const entries = toTimelineEntries([
      raw("PenaltyStarted", "2026-08-05", 1, {
        day: "2026-08-05",
        variantId: 1,
        expLost: 50,
      }),
    ]);
    expect(entries[0]).toMatchObject({
      kind: "penalty-zone",
      day: "2026-08-05",
    });
  });

  it("turns a LevelUp that crosses a rank threshold into a RANK UP entry", () => {
    // Level 20 is C-Rank's floor; level 19 is still D — see RANK_THRESHOLDS.
    const entries = toTimelineEntries([
      raw("LevelUp", "2026-08-05", 1, { from: 19, to: 20 }),
    ]);
    expect(entries).toEqual([
      {
        kind: "rank-up",
        day: "2026-08-05",
        occurredAt: 1,
        summary: "D → C",
      },
    ]);
  });

  it("REGRESSION: a LevelUp that does NOT cross a rank threshold produces no entry at all", () => {
    const entries = toTimelineEntries([
      raw("LevelUp", "2026-08-05", 1, { from: 21, to: 22 }),
    ]);
    expect(entries).toEqual([]);
  });

  it("ignores every other event type — the timeline is curated, not a raw event dump", () => {
    const entries = toTimelineEntries([
      raw("SetLogged", "2026-08-05", 1, {
        exerciseId: "bench-press",
        setIndex: 0,
      }),
      raw("GoldGained", "2026-08-05", 1, { amount: 50, source: "daily-quest" }),
      raw("QuestProgressLogged", "2026-08-05", 1, { day: "2026-08-05" }),
    ]);
    expect(entries).toEqual([]);
  });

  it("returns entries oldest first, matching input order", () => {
    const entries = toTimelineEntries([
      raw("ShadowArisen", "2026-08-01", 1, {
        shadowId: "igris",
        shadowName: "Igris",
      }),
      raw("ShadowArisen", "2026-08-05", 2, {
        shadowId: "iron",
        shadowName: "Iron",
      }),
    ]);
    expect(entries.map((e) => e.day)).toEqual(["2026-08-01", "2026-08-05"]);
  });
});
