import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { buyInstantDungeonKey } from "./buy-instant-dungeon-key";

async function containerWith(gold: number): Promise<Container> {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-09T01:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold });
  return container;
}

describe("buyInstantDungeonKey", () => {
  it("charges 800 gold and reports the remaining balance", async () => {
    const container = await containerWith(1_000);
    const result = await buyInstantDungeonKey(container, {
      programDayId: "upper-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldSpent).toBe(800);
    expect(result.value.goldRemaining).toBe(200);
    expect((await container.hunters.get())?.gold).toBe(200);
  });

  it("names the key as the source on the GoldSpent event", async () => {
    const container = await containerWith(1_000);
    const result = await buyInstantDungeonKey(container, {
      programDayId: "upper-a",
    });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "GoldSpent",
      amount: 800,
      source: "instant-dungeon-key",
    });
  });

  it("refuses a program day that does not exist, without charging", async () => {
    const container = await containerWith(1_000);
    const result = await buyInstantDungeonKey(container, {
      programDayId: "no-such-day",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("program-day-not-found");
    expect((await container.hunters.get())?.gold).toBe(1_000);
  });

  it("refuses when the gold is short", async () => {
    const container = await containerWith(799);
    const result = await buyInstantDungeonKey(container, {
      programDayId: "upper-a",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("insufficient-gold");
    expect((await container.hunters.get())?.gold).toBe(799);
  });

  it("starts no session — opening the gate is the caller's next step", async () => {
    const container = await containerWith(1_000);
    await buyInstantDungeonKey(container, { programDayId: "upper-a" });
    const sessions = await container.training.completedSessionsBetween(
      "2000-01-01",
      "2100-01-01",
    );
    expect(sessions).toEqual([]);
  });
});
