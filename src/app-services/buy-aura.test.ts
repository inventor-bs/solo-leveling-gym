import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import type { TrainingDay } from "@/core/shared/training-day";
import { AURA_VISUAL_MAX_LEVEL } from "@/core/economy/pricing";
import { auraCost } from "@/core/cosmetic/aura";
import { buyAura } from "./buy-aura";

async function containerWith(gold: number, auraLevel = 0): Promise<Container> {
  const db = await makeTestDb();
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold, auraLevel });
  return container;
}

describe("buyAura", () => {
  it("charges the base price for the first purchase and raises the level to one", async () => {
    const container = await containerWith(10_000);
    const result = await buyAura(container);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cost).toBe(3_000);
    expect(result.value.auraLevel).toBe(1);
    expect(result.value.goldRemaining).toBe(7_000);
    expect((await container.hunters.get())?.auraLevel).toBe(1);
  });

  it("prices each purchase from the CURRENT level, not a fixed constant", async () => {
    const container = await containerWith(20_000);
    const first = await buyAura(container);
    const second = await buyAura(container);
    expect(first.ok && first.value.cost).toBe(3_000);
    expect(second.ok && second.value.cost).toBe(4_500);
    expect((await container.hunters.get())?.gold).toBe(20_000 - 3_000 - 4_500);
  });

  it("quotes the next price alongside the one just paid", async () => {
    const container = await containerWith(20_000);
    const result = await buyAura(container);
    expect(result.ok && result.value.nextCost).toBe(auraCost(1));
  });

  it("raises the level by exactly one per purchase", async () => {
    const container = await containerWith(50_000, 2);
    await buyAura(container);
    expect((await container.hunters.get())?.auraLevel).toBe(3);
  });

  it("still charges escalating gold past the visual cap and still counts the purchase", async () => {
    // Deliberate: this is the economy's only sink with no ceiling. A future
    // reader who "fixes" this into a hard cap breaks the thing it is for.
    const container = await containerWith(200_000, AURA_VISUAL_MAX_LEVEL);
    const result = await buyAura(container);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cost).toBe(auraCost(AURA_VISUAL_MAX_LEVEL));
    expect(result.value.auraLevel).toBe(AURA_VISUAL_MAX_LEVEL + 1);
    // The gold moved; the screen did not.
    expect(result.value.visualTier).toBe(AURA_VISUAL_MAX_LEVEL);
    expect(result.value.saturated).toBe(true);
  });

  it("refuses when gold is short and leaves the level untouched", async () => {
    const container = await containerWith(2_999);
    const result = await buyAura(container);
    expect(result).toEqual({ ok: false, error: { type: "insufficient-gold" } });
    expect((await container.hunters.get())?.auraLevel).toBe(0);
    expect((await container.hunters.get())?.gold).toBe(2_999);
  });

  it("refuses when there is no hunter at all", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-14T05:00:00Z"),
    });
    const result = await buyAura(container);
    expect(result).toEqual({ ok: false, error: { type: "hunter-not-found" } });
  });

  it("records a GoldSpent event naming the aura", async () => {
    const container = await containerWith(10_000);
    await buyAura(container);
    const rows = await container.events.between(
      "2026-08-14" as TrainingDay,
      "2026-08-14" as TrainingDay,
    );
    const spent = rows.filter((r) => r.type === "GoldSpent");
    expect(spent).toHaveLength(1);
    expect(JSON.parse(spent[0]?.payload ?? "").source).toBe("cosmetic:aura");
  });
});
