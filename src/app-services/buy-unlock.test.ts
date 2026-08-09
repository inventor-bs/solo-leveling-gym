import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { buyUnlock } from "./buy-unlock";

async function containerWith(gold: number, level = 1): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-09T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold, level });
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 0 : null,
    })),
  );
  return container;
}

describe("buyUnlock", () => {
  it("unlocks a dungeon type, deducting exactly its price", async () => {
    const container = await containerWith(2_000);
    const result = await buyUnlock(container, "dungeon-type:amrap");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldRemaining).toBe(800);
    expect(await container.store.isUnlocked("dungeon-type:amrap")).toBe(true);
    expect((await container.hunters.get())?.gold).toBe(800);
  });

  it("records a GoldSpent event naming what the gold bought", async () => {
    const container = await containerWith(2_000);
    const result = await buyUnlock(container, "dungeon-type:emom");
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "GoldSpent",
      amount: 1_200,
      source: "dungeon-type:emom",
    });
  });

  it("persists the GoldSpent event so the Chronicle can explain the balance", async () => {
    const container = await containerWith(2_000);
    await buyUnlock(container, "dungeon-type:emom");
    const rows = await container.events.between(
      "2026-08-09" as never,
      "2026-08-09" as never,
    );
    expect(rows.map((r) => r.type)).toContain("GoldSpent");
  });

  it("refuses a key that is not in the catalog", async () => {
    const container = await containerWith(99_999);
    const result = await buyUnlock(container, "program:starting-strength");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("unknown-unlock");
  });

  it("refuses to charge twice for something already unlocked", async () => {
    const container = await containerWith(5_000);
    await buyUnlock(container, "dungeon-type:amrap");
    const again = await buyUnlock(container, "dungeon-type:amrap");
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.type).toBe("already-unlocked");
    expect((await container.hunters.get())?.gold).toBe(3_800);
  });

  it("refuses a level-gated program below its level, without charging", async () => {
    const container = await containerWith(9_999, 19);
    const result = await buyUnlock(container, "program:ppl");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("requirement-not-met");
    expect((await container.hunters.get())?.gold).toBe(9_999);
  });

  it("allows a level-gated program at its level", async () => {
    const container = await containerWith(9_999, 20);
    const result = await buyUnlock(container, "program:ppl");
    expect(result.ok).toBe(true);
  });

  it("refuses an exercise unlock while the army is below Elite", async () => {
    const container = await containerWith(9_999, 50);
    const result = await buyUnlock(container, "exercise:back");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("requirement-not-met");
  });

  it("refuses when the gold is short, and leaves the balance untouched", async () => {
    const container = await containerWith(1_199);
    const result = await buyUnlock(container, "dungeon-type:amrap");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("insufficient-gold");
    expect((await container.hunters.get())?.gold).toBe(1_199);
    expect(await container.store.isUnlocked("dungeon-type:amrap")).toBe(false);
  });
});
