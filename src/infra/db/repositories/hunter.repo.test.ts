import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { HunterRepo } from "./hunter.repo";
import type { Db } from "../client";

let db: Db;
let repo: HunterRepo;

beforeEach(async () => {
  db = await makeTestDb();
  repo = new HunterRepo(db);
});

describe("HunterRepo", () => {
  it("get() returns null when no hunter exists yet", async () => {
    expect(await repo.get()).toBeNull();
  });

  it("create() then get() returns the same hunter", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    const h = await repo.get();
    expect(h?.name).toBe("Jin-Woo");
    expect(h?.id).toBe(1);
    expect(h?.level).toBe(1);
    expect(h?.rank).toBe("E");
    expect(h?.tzOffsetMinutes).toBe(420);
  });

  it("update() changes the specified fields", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await repo.update({ level: 5, exp: 1200, strength: 41.5 });
    const h = await repo.get();
    expect(h?.level).toBe(5);
    expect(h?.exp).toBe(1200);
    expect(h?.strength).toBe(41.5);
    expect(h?.name).toBe("Jin-Woo");
  });

  it("update() with an empty patch changes nothing", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await repo.update({});
    expect((await repo.get())?.name).toBe("Jin-Woo");
  });

  it("a second create() throws — there can only ever be one hunter", async () => {
    await repo.create({ name: "Jin-Woo", createdAt: 1754400000000 });
    await expect(
      repo.create({ name: "Someone Else", createdAt: 1754400000000 }),
    ).rejects.toThrow();
  });
});
