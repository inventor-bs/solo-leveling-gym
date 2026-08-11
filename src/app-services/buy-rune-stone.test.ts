import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { SKILL_CATALOG } from "@/core/skill/catalog";
import { RUNE_STONE_COST } from "@/core/economy/pricing";
import { SKILL_SLOTS_MAX, SKILL_SLOTS_BASE } from "@/core/skill/slots";
import { buyRuneStone } from "./buy-rune-stone";

describe("buyRuneStone", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed(SKILL_CATALOG.map((s) => ({ id: s.id })));
  });

  it("refuses when gold is short", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({ gold: RUNE_STONE_COST - 1 });
    const result = await buyRuneStone(container);
    expect(result).toEqual({ ok: false, error: { type: "insufficient-gold" } });
  });

  it("spends gold and increases slot capacity by one", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({ gold: RUNE_STONE_COST });
    const result = await buyRuneStone(container);
    expect(result.ok).toBe(true);
    expect((await container.hunters.get())?.gold).toBe(0);
    expect(await container.skills.slotsPurchased()).toBe(1);
  });

  it("refuses once capacity is already at the maximum", async () => {
    const purchasesNeeded = SKILL_SLOTS_MAX - SKILL_SLOTS_BASE;
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({
      gold: RUNE_STONE_COST * (purchasesNeeded + 1),
    });
    for (let i = 0; i < purchasesNeeded; i++) {
      const r = await buyRuneStone(container);
      expect(r.ok).toBe(true);
    }
    const result = await buyRuneStone(container);
    expect(result).toEqual({ ok: false, error: { type: "slots-maxed" } });
  });
});
