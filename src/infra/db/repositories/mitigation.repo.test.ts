import { describe, it, expect } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { MitigationRepo } from "./mitigation.repo";

async function repo() {
  return new MitigationRepo(await makeTestDb());
}

describe("MitigationRepo hourglass", () => {
  it("has no grace for a day nothing was bought on", async () => {
    const mitigation = await repo();
    expect(await mitigation.graceForDay("2026-08-09")).toBeNull();
  });

  it("grants grace for one day and reads it back", async () => {
    const mitigation = await repo();
    await mitigation.grantGrace("2026-08-09", 1_000);
    const row = await mitigation.graceForDay("2026-08-09");
    expect(row?.usedAt).toBe(1_000);
    expect(await mitigation.graceForDay("2026-08-08")).toBeNull();
  });

  it("counts graces inside a week window, for the one-per-week cap", async () => {
    const mitigation = await repo();
    await mitigation.grantGrace("2026-08-03", 1);
    await mitigation.grantGrace("2026-08-06", 2);
    await mitigation.grantGrace("2026-08-11", 3);
    const week = await mitigation.gracesBetween("2026-08-03", "2026-08-09");
    expect(week.map((g) => g.day)).toEqual(["2026-08-03", "2026-08-06"]);
  });
});

describe("MitigationRepo shadow feed", () => {
  it("has no feed for an unfed shadow", async () => {
    const mitigation = await repo();
    expect(await mitigation.feedFor("igris")).toBeNull();
    expect(await mitigation.allFeeds()).toEqual([]);
  });

  it("records the day a fed shadow's reference is extended to", async () => {
    const mitigation = await repo();
    await mitigation.feed("igris", "2026-08-12");
    expect((await mitigation.feedFor("igris"))?.extendedUntilDay).toBe(
      "2026-08-12",
    );
  });

  it("replaces an existing feed rather than stacking a second row", async () => {
    const mitigation = await repo();
    await mitigation.feed("igris", "2026-08-12");
    await mitigation.feed("igris", "2026-08-15");
    const feeds = await mitigation.allFeeds();
    expect(feeds).toHaveLength(1);
    expect(feeds[0]?.extendedUntilDay).toBe("2026-08-15");
  });
});
