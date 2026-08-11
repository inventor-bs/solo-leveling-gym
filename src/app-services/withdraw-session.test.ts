import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { withdrawSession } from "./withdraw-session";

describe("withdrawSession", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-11T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed([{ id: "shadow-storage" }]);
    await container.skills.learn("shadow-storage", 100);
    await container.skills.equip("shadow-storage", 100);
  });

  it("refuses without Shadow Storage learned and equipped", async () => {
    await container.skills.unequip("shadow-storage");
    const result = await withdrawSession(container);
    expect(result).toEqual({
      ok: false,
      error: { type: "skill-not-equipped" },
    });
  });

  it("refuses with zero banked sessions", async () => {
    const result = await withdrawSession(container);
    expect(result).toEqual({
      ok: false,
      error: { type: "no-banked-sessions" },
    });
  });

  it("withdraws a banked session into a pending credit", async () => {
    await container.skills.deposit("session-1", container.clock.now());
    const result = await withdrawSession(container);
    expect(result.ok).toBe(true);
    const bank = await container.skills.bank();
    expect(bank.bankedSessions).toBe(0);
    expect(bank.pendingCredits).toBe(1);
  });
});
