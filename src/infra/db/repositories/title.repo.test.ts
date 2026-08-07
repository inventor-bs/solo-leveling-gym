import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { TitleRepo } from "./title.repo";

let db: Db;
let titles: TitleRepo;

beforeEach(async () => {
  db = await makeTestDb();
  titles = new TitleRepo(db);
});

describe("TitleRepo", () => {
  it("is empty before seeding", async () => {
    expect(await titles.all()).toEqual([]);
  });

  it("seeds rows unearned by default", async () => {
    await titles.seed([
      { id: "unyielding", name: "Unyielding", earnedAt: null },
      { id: "monarch-of-dawn", name: "Monarch of Dawn", earnedAt: null },
    ]);
    const all = await titles.all();
    expect(all).toHaveLength(2);
    expect(all.every((t) => t.earnedAt === null)).toBe(true);
  });

  it("REGRESSION: re-seeding never resets a title that was already earned", async () => {
    // The deploy-time seed runs on every build. If it overwrote earnedAt,
    // every deploy would silently un-earn every title.
    await titles.seed([
      { id: "unyielding", name: "Unyielding", earnedAt: null },
    ]);
    await titles.earn("unyielding", 1234);
    await titles.seed([
      { id: "unyielding", name: "Unyielding", earnedAt: null },
    ]);

    const all = await titles.all();
    expect(all).toHaveLength(1);
    expect(all[0]?.earnedAt).toBe(1234);
  });

  it("byId returns null for an unknown id", async () => {
    expect(await titles.byId("wolfs-nemesis")).toBeNull();
  });

  it("earn stamps the moment it was earned", async () => {
    await titles.seed([
      { id: "unyielding", name: "Unyielding", earnedAt: null },
    ]);
    await titles.earn("unyielding", 500);
    expect((await titles.byId("unyielding"))?.earnedAt).toBe(500);
  });

  it("REGRESSION: earn never overwrites the original moment", async () => {
    await titles.seed([
      { id: "unyielding", name: "Unyielding", earnedAt: null },
    ]);
    await titles.earn("unyielding", 500);
    await titles.earn("unyielding", 9999);
    expect((await titles.byId("unyielding"))?.earnedAt).toBe(500);
  });

  it("earn on an unknown id is a no-op, not a throw", async () => {
    await titles.earn("wolfs-nemesis", 1);
    expect(await titles.all()).toEqual([]);
  });
});
