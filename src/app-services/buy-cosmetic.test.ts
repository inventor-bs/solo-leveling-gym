import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import type { TrainingDay } from "@/core/shared/training-day";
import {
  DASHBOARD_LAYOUT_COST,
  SHADOW_SKIN_COST,
  TITLE_FRAME_COST,
} from "@/core/economy/pricing";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  shadowSkinKey,
  titleFrameKey,
} from "@/core/cosmetic/catalog";
import { buyCosmetic } from "./buy-cosmetic";

async function containerWith(gold: number): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold });
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      // Only Igris starts extracted, which is what the roster says and what
      // makes "tank is not extracted" a real case below rather than a setup.
      extractedAt: s.startsExtracted ? 0 : null,
    })),
  );
  return container;
}

describe("buyCosmetic — dashboard layout", () => {
  it("charges the price once and records the unlock", async () => {
    const container = await containerWith(1_000);
    const result = await buyCosmetic(container, { kind: "dashboard-layout" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.key).toBe(DASHBOARD_LAYOUT_UNLOCK_KEY);
    expect(result.value.goldRemaining).toBe(1_000 - DASHBOARD_LAYOUT_COST);
    expect(await container.store.isUnlocked(DASHBOARD_LAYOUT_UNLOCK_KEY)).toBe(
      true,
    );
  });

  it("refuses a second purchase and takes no gold for it", async () => {
    const container = await containerWith(1_000);
    await buyCosmetic(container, { kind: "dashboard-layout" });
    const before = (await container.hunters.get())?.gold;
    const result = await buyCosmetic(container, { kind: "dashboard-layout" });
    expect(result).toEqual({ ok: false, error: { type: "already-unlocked" } });
    expect((await container.hunters.get())?.gold).toBe(before);
  });

  it("refuses when gold is short, and unlocks nothing", async () => {
    const container = await containerWith(DASHBOARD_LAYOUT_COST - 1);
    const result = await buyCosmetic(container, { kind: "dashboard-layout" });
    expect(result).toEqual({ ok: false, error: { type: "insufficient-gold" } });
    expect(await container.store.isUnlocked(DASHBOARD_LAYOUT_UNLOCK_KEY)).toBe(
      false,
    );
    expect((await container.hunters.get())?.gold).toBe(
      DASHBOARD_LAYOUT_COST - 1,
    );
  });

  it("records a GoldSpent event naming the cosmetic that took the gold", async () => {
    const container = await containerWith(1_000);
    await buyCosmetic(container, { kind: "dashboard-layout" });
    // `as TrainingDay` matches how every existing app-service test in this
    // repo passes a literal day to the event log; the brand is compile-time.
    const rows = await container.events.between(
      "2026-08-14" as TrainingDay,
      "2026-08-14" as TrainingDay,
    );
    const spent = rows.filter((r) => r.type === "GoldSpent");
    expect(spent).toHaveLength(1);
    expect(JSON.parse(spent[0]?.payload ?? "")).toEqual({
      amount: DASHBOARD_LAYOUT_COST,
      source: "cosmetic:dashboard-layout",
    });
  });
});

describe("buyCosmetic — shadow skin", () => {
  it("unlocks the exact (skin, shadow) pair and no other", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "shadow-skin",
      skinId: "void",
      shadowId: "igris",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldRemaining).toBe(5_000 - SHADOW_SKIN_COST.void);
    expect(
      await container.store.isUnlocked(shadowSkinKey("void", "igris")),
    ).toBe(true);
    expect(
      await container.store.isUnlocked(shadowSkinKey("void", "tank")),
    ).toBe(false);
    expect(
      await container.store.isUnlocked(shadowSkinKey("ember", "igris")),
    ).toBe(false);
  });

  it("refuses a shadow that has not been extracted", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "shadow-skin",
      skinId: "ember",
      shadowId: "tank",
    });
    expect(result).toEqual({
      ok: false,
      error: { type: "shadow-not-extracted" },
    });
    expect((await container.hunters.get())?.gold).toBe(5_000);
  });

  it("refuses a shadow that does not exist", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "shadow-skin",
      skinId: "ember",
      shadowId: "not-a-shadow",
    });
    expect(result).toEqual({ ok: false, error: { type: "shadow-not-found" } });
    expect((await container.hunters.get())?.gold).toBe(5_000);
  });

  it("refuses a skin id that is not in the catalog", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "shadow-skin",
      skinId: "plasma",
      shadowId: "igris",
    });
    expect(result).toEqual({ ok: false, error: { type: "unknown-cosmetic" } });
    expect((await container.hunters.get())?.gold).toBe(5_000);
  });
});

describe("buyCosmetic — title frame", () => {
  it("charges the frame's own price and unlocks it", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "title-frame",
      frameId: "monarch",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldRemaining).toBe(5_000 - TITLE_FRAME_COST.monarch);
    expect(await container.store.isUnlocked(titleFrameKey("monarch"))).toBe(
      true,
    );
  });

  it("refuses a frame id that is not in the catalog", async () => {
    const container = await containerWith(5_000);
    const result = await buyCosmetic(container, {
      kind: "title-frame",
      frameId: "bronze",
    });
    expect(result).toEqual({ ok: false, error: { type: "unknown-cosmetic" } });
    expect((await container.hunters.get())?.gold).toBe(5_000);
  });
});
