import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { placeWager } from "./place-wager";

async function containerAt(day: string, gold: number): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock(`${day}T01:00:00Z`),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold });
  return container;
}

describe("placeWager", () => {
  it("takes the stake immediately and opens the week as active", async () => {
    // 2026-08-10 is a Monday.
    const container = await containerAt("2026-08-10", 1_000);
    const result = await placeWager(container, 400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.weekStart).toBe("2026-08-10");
    expect(result.value.goldRemaining).toBe(600);
    const row = await container.wagers.byWeek("2026-08-10");
    expect(row?.status).toBe("active");
    expect(row?.stakeGold).toBe(400);
  });

  it("records the stake as spent, tagged as a wager", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    const result = await placeWager(container, 400);
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "GoldSpent",
      amount: 400,
      source: "wager",
    });
  });

  it("refuses on any day but Monday", async () => {
    const container = await containerAt("2026-08-11", 1_000);
    const result = await placeWager(container, 400);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("wager-not-monday");
    expect((await container.hunters.get())?.gold).toBe(1_000);
  });

  it("refuses a stake over half the gold on hand", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    const result = await placeWager(container, 501);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("stake-too-large");
  });

  it("allows a stake of exactly half", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    expect((await placeWager(container, 500)).ok).toBe(true);
  });

  it("refuses a second wager on the same week", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    await placeWager(container, 100);
    const second = await placeWager(container, 100);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.type).toBe("wager-already-placed");
    expect((await container.hunters.get())?.gold).toBe(900);
  });

  it("refuses a zero or fractional stake", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    expect((await placeWager(container, 0)).ok).toBe(false);
    expect((await placeWager(container, 10.5)).ok).toBe(false);
  });

  it("reports the cap it enforced, so the UI can show it", async () => {
    const container = await containerAt("2026-08-10", 999);
    const result = await placeWager(container, 499);
    if (!result.ok) return;
    expect(result.value.maxStake).toBe(499);
  });
});
