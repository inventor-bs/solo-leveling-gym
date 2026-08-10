import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { SkillRepo } from "./skill.repo";

describe("SkillRepo", () => {
  let repo: SkillRepo;

  beforeEach(async () => {
    const db = await makeTestDb();
    repo = new SkillRepo(db);
    await repo.seed([{ id: "tenacity" }, { id: "vital-strike" }]);
  });

  it("seed is idempotent and does not reset a learned row", async () => {
    await repo.learn("tenacity", 100);
    await repo.seed([{ id: "tenacity" }]);
    const row = await repo.byId("tenacity");
    expect(row?.learnedAt).toBe(100);
  });

  it("learn only stamps learnedAt the first time", async () => {
    await repo.learn("tenacity", 100);
    await repo.learn("tenacity", 200);
    const row = await repo.byId("tenacity");
    expect(row?.learnedAt).toBe(100);
  });

  it("equip and unequip toggle equippedAt, and equippedIds reflects it", async () => {
    await repo.learn("tenacity", 100);
    await repo.equip("tenacity", 150);
    expect(await repo.equippedIds()).toEqual(["tenacity"]);
    await repo.unequip("tenacity");
    expect(await repo.equippedIds()).toEqual([]);
  });

  it("slotsPurchased defaults to 0 and purchaseSlot increments it", async () => {
    expect(await repo.slotsPurchased()).toBe(0);
    await repo.purchaseSlot();
    expect(await repo.slotsPurchased()).toBe(1);
  });
});
