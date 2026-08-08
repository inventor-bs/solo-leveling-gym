import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { NarrativeRepo } from "./narrative.repo";

let repo: NarrativeRepo;

beforeEach(async () => {
  repo = new NarrativeRepo(await makeTestDb());
});

describe("NarrativeRepo", () => {
  it("starts empty — nothing is seeded", async () => {
    expect(await repo.all()).toEqual([]);
    expect(await repo.unlockedIds()).toEqual([]);
    expect(await repo.latestUnlockedDay()).toBeNull();
  });

  it("records an unlock and reads it back", async () => {
    await repo.unlock("first-anomaly", 1, "2026-08-08", 1000);
    const rows = await repo.all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "first-anomaly",
      ordinal: 1,
      unlockedDay: "2026-08-08",
      unlockedAt: 1000,
    });
  });

  it("orders rows by ordinal so the Archive reads in story order", async () => {
    await repo.unlock("maintenance-window", 2, "2026-08-15", 2000);
    await repo.unlock("first-anomaly", 1, "2026-08-08", 1000);
    expect(await repo.unlockedIds()).toEqual([
      "first-anomaly",
      "maintenance-window",
    ]);
  });

  it("REGRESSION: unlocking twice never rewrites the original day or instant", async () => {
    await repo.unlock("first-anomaly", 1, "2026-08-08", 1000);
    await repo.unlock("first-anomaly", 1, "2026-09-01", 9999);
    const rows = await repo.all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unlockedDay).toBe("2026-08-08");
    expect(rows[0]?.unlockedAt).toBe(1000);
  });

  it("reports the day of the most recent unlock", async () => {
    await repo.unlock("first-anomaly", 1, "2026-08-08", 1000);
    await repo.unlock("maintenance-window", 2, "2026-08-15", 2000);
    expect(await repo.latestUnlockedDay()).toBe("2026-08-15");
  });
});
