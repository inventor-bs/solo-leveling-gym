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

  it("consumeCredit never drives pendingCredits negative across repeated calls", async () => {
    await repo.deposit("s1", 100);
    await repo.withdraw(); // bankedSessions -> 0, pendingCredits -> 1

    const first = await repo.consumeCredit();
    const second = await repo.consumeCredit();
    const third = await repo.consumeCredit();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);
    expect((await repo.bank()).pendingCredits).toBe(0);
  });

  it("withdraw never drives bankedSessions negative across repeated calls", async () => {
    await repo.deposit("s1", 100);

    const first = await repo.withdraw();
    const second = await repo.withdraw();
    const third = await repo.withdraw();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);
    const bank = await repo.bank();
    expect(bank.bankedSessions).toBe(0);
    // Only the one successful withdraw should have produced a credit.
    expect(bank.pendingCredits).toBe(1);
  });

  describe("job change attempt tracking", () => {
    it("has no attempt by default", async () => {
      expect(await repo.jobChangeAttempt()).toBeNull();
    });

    it("starts, progresses, and completes an attempt", async () => {
      await repo.startJobChangeAttempt("2026-08-10", 100);
      await repo.updateJobChangeProgress(1);
      await repo.updateJobChangeProgress(2);
      let attempt = await repo.jobChangeAttempt();
      expect(attempt).toMatchObject({
        consecutiveCleared: 2,
        completedAt: null,
        failedAt: null,
      });

      await repo.completeJobChangeAttempt(200);
      attempt = await repo.jobChangeAttempt();
      expect(attempt?.completedAt).toBe(200);
    });

    it("starting a new attempt after a failure replaces the old row", async () => {
      await repo.startJobChangeAttempt("2026-08-10", 100);
      await repo.failJobChangeAttempt(150);
      await repo.startJobChangeAttempt("2026-09-01", 300);
      const attempt = await repo.jobChangeAttempt();
      expect(attempt).toMatchObject({
        startedDay: "2026-09-01",
        consecutiveCleared: 0,
        failedAt: null,
      });
    });
  });
});
