import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { buyShadowFeed } from "./buy-shadow-feed";

async function containerAt(day: string, gold: number): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock(`${day}T05:00:00Z`),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold });
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

describe("buyShadowFeed", () => {
  it("charges 600 gold and extends the shadow's reference day by three", async () => {
    const container = await containerAt("2026-08-09", 1_000);
    const result = await buyShadowFeed(container, "igris");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.extendedUntilDay).toBe("2026-08-12");
    expect(result.value.goldRemaining).toBe(400);
  });

  it("never writes the shadow's stored EXP", async () => {
    const container = await containerAt("2026-08-09", 1_000);
    await container.shadows.addExp("igris", 5_000, "2026-08-01");
    const before = (await container.shadows.byId("igris"))?.exp;
    await buyShadowFeed(container, "igris");
    expect((await container.shadows.byId("igris"))?.exp).toBe(before);
  });

  it("refuses a shadow that does not exist", async () => {
    const container = await containerAt("2026-08-09", 1_000);
    const result = await buyShadowFeed(container, "no-such-shadow");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("shadow-not-found");
    expect((await container.hunters.get())?.gold).toBe(1_000);
  });

  it("refuses a shadow that has not been extracted yet", async () => {
    const container = await containerAt("2026-08-09", 1_000);
    const result = await buyShadowFeed(container, "bellion");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("shadow-not-extracted");
  });

  it("refuses when the gold is short", async () => {
    const container = await containerAt("2026-08-09", 599);
    const result = await buyShadowFeed(container, "igris");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("insufficient-gold");
  });

  it("replaces an existing feed rather than stacking on top of it", async () => {
    const container = await containerAt("2026-08-09", 2_000);
    await container.mitigation.feed("igris", "2026-08-20");
    const result = await buyShadowFeed(container, "igris");
    if (!result.ok) return;
    expect(result.value.extendedUntilDay).toBe("2026-08-12");
  });
});
