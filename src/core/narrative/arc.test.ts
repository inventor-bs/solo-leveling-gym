import { describe, it, expect } from "vitest";
import {
  arcStageFor,
  milestoneMet,
  nextFragmentToUnlock,
  sealedCount,
  type NarrativeProgress,
} from "./arc";
import { NARRATIVE_FRAGMENTS } from "./fragments";

function progress(patch: Partial<NarrativeProgress> = {}): NarrativeProgress {
  return { daysSinceStart: 0, level: 1, rank: "E", ...patch };
}

const idsUpTo = (n: number): string[] =>
  NARRATIVE_FRAGMENTS.slice(0, n).map((f) => f.id);

describe("milestoneMet", () => {
  it("opens a day gate on the exact day, not a day late", () => {
    const day7 = NARRATIVE_FRAGMENTS[0]!;
    expect(milestoneMet(day7, progress({ daysSinceStart: 6 }))).toBe(false);
    expect(milestoneMet(day7, progress({ daysSinceStart: 7 }))).toBe(true);
  });

  it("opens a level gate at the exact level", () => {
    const level5 = NARRATIVE_FRAGMENTS[3]!;
    expect(milestoneMet(level5, progress({ level: 4 }))).toBe(false);
    expect(milestoneMet(level5, progress({ level: 5 }))).toBe(true);
  });

  it("treats a higher rank as satisfying a lower rank's gate", () => {
    const rankD = NARRATIVE_FRAGMENTS[4]!;
    expect(milestoneMet(rankD, progress({ rank: "E" }))).toBe(false);
    expect(milestoneMet(rankD, progress({ rank: "D" }))).toBe(true);
    expect(milestoneMet(rankD, progress({ rank: "S" }))).toBe(true);
    expect(milestoneMet(rankD, progress({ rank: "Monarch" }))).toBe(true);
  });
});

describe("nextFragmentToUnlock", () => {
  it("unlocks nothing before the first milestone lands", () => {
    expect(
      nextFragmentToUnlock([], progress({ daysSinceStart: 6 })),
    ).toBeNull();
  });

  it("unlocks the day-7 fragment on day 7", () => {
    const next = nextFragmentToUnlock([], progress({ daysSinceStart: 7 }));
    expect(next?.id).toBe("first-anomaly");
  });

  it("unlocks the day-14 fragment once the day-7 one is already read", () => {
    const next = nextFragmentToUnlock(
      ["first-anomaly"],
      progress({ daysSinceStart: 14 }),
    );
    expect(next?.id).toBe("maintenance-window");
  });

  it("returns exactly one fragment even when several conditions are met", () => {
    const next = nextFragmentToUnlock(
      [],
      progress({ daysSinceStart: 400, level: 99, rank: "Monarch" }),
    );
    expect(next?.id).toBe("first-anomaly");
  });

  it("REGRESSION: never skips ahead to a later fragment whose gate opened first", () => {
    // Day 30 gates fragment 3; level 5 gates fragment 4. A hunter who is
    // level 5 on day 10 satisfies fragment 4 and not fragment 3 — the arc
    // must stall rather than tell the story out of order.
    const next = nextFragmentToUnlock(
      idsUpTo(2),
      progress({ daysSinceStart: 10, level: 5 }),
    );
    expect(next).toBeNull();
  });

  it("releases the backlog one fragment at a time once the stall clears", () => {
    const p = progress({ daysSinceStart: 30, level: 5 });
    expect(nextFragmentToUnlock(idsUpTo(2), p)?.id).toBe("unlisted-process");
    expect(nextFragmentToUnlock(idsUpTo(3), p)?.id).toBe("incomplete-record");
    expect(nextFragmentToUnlock(idsUpTo(4), p)).toBeNull();
  });

  it("returns null once the whole arc has been read", () => {
    const all = NARRATIVE_FRAGMENTS.map((f) => f.id);
    const p = progress({ daysSinceStart: 9999, level: 99, rank: "Monarch" });
    expect(nextFragmentToUnlock(all, p)).toBeNull();
  });
});

describe("arcStageFor", () => {
  it("is dormant before anything is unlocked", () => {
    expect(arcStageFor([])).toBe("dormant");
  });

  it("reports the stage of the highest fragment read so far", () => {
    expect(arcStageFor(idsUpTo(1))).toBe("anomaly");
    expect(arcStageFor(idsUpTo(6))).toBe("inquiry");
    expect(arcStageFor(idsUpTo(11))).toBe("revelation");
    expect(arcStageFor(NARRATIVE_FRAGMENTS.map((f) => f.id))).toBe("closed");
  });

  it("ignores ids that are not in the catalog", () => {
    expect(arcStageFor(["not-a-fragment"])).toBe("dormant");
  });
});

describe("sealedCount", () => {
  it("counts how much of the arc has not been read", () => {
    expect(sealedCount([])).toBe(15);
    expect(sealedCount(idsUpTo(2))).toBe(13);
    expect(sealedCount(NARRATIVE_FRAGMENTS.map((f) => f.id))).toBe(0);
  });
});
