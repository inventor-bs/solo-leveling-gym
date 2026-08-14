import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { shadowSkinKey } from "@/core/cosmetic/catalog";
import { equipShadowSkin } from "./equip-shadow-skin";

async function containerWithArmy(): Promise<Container> {
  const db = await makeTestDb();
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 0 : null,
    })),
  );
  // Tank is extracted here so the "owned for another shadow" case below is
  // about ownership alone and not about extraction.
  await container.shadows.extract("tank", 1);
  return container;
}

describe("equipShadowSkin", () => {
  it("equips a skin owned for that exact shadow", async () => {
    const container = await containerWithArmy();
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);

    const result = await equipShadowSkin(container, "igris", "void");
    expect(result).toEqual({
      ok: true,
      value: { shadowId: "igris", equippedSkinId: "void" },
    });
    expect((await container.shadows.byId("igris"))?.equippedSkinId).toBe(
      "void",
    );
  });

  it("refuses a skin owned for a DIFFERENT shadow", async () => {
    // The likeliest bug in this whole phase: ownership is per (skin, shadow)
    // pair, so owning Void on Igris must grant nothing on Tank.
    const container = await containerWithArmy();
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);

    const result = await equipShadowSkin(container, "tank", "void");
    expect(result).toEqual({
      ok: false,
      error: { type: "cosmetic-not-owned" },
    });
    expect((await container.shadows.byId("tank"))?.equippedSkinId).toBeNull();
  });

  it("refuses a skin nobody owns", async () => {
    const container = await containerWithArmy();
    const result = await equipShadowSkin(container, "igris", "frost");
    expect(result).toEqual({
      ok: false,
      error: { type: "cosmetic-not-owned" },
    });
  });

  it("refuses a shadow that has not been extracted", async () => {
    const container = await containerWithArmy();
    await container.store.unlock(shadowSkinKey("ember", "beru"), 0);
    const result = await equipShadowSkin(container, "beru", "ember");
    expect(result).toEqual({
      ok: false,
      error: { type: "shadow-not-extracted" },
    });
  });

  it("refuses a shadow that does not exist", async () => {
    const container = await containerWithArmy();
    const result = await equipShadowSkin(container, "nobody", "ember");
    expect(result).toEqual({ ok: false, error: { type: "shadow-not-found" } });
  });

  it("refuses a skin id that is not in the catalog", async () => {
    const container = await containerWithArmy();
    const result = await equipShadowSkin(container, "igris", "plasma");
    expect(result).toEqual({ ok: false, error: { type: "unknown-cosmetic" } });
  });

  it("always allows taking a skin off, with no ownership check", async () => {
    const container = await containerWithArmy();
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);
    await equipShadowSkin(container, "igris", "void");

    const result = await equipShadowSkin(container, "igris", null);
    expect(result).toEqual({
      ok: true,
      value: { shadowId: "igris", equippedSkinId: null },
    });
    expect((await container.shadows.byId("igris"))?.equippedSkinId).toBeNull();
  });

  it("never touches the shadow's stored exp", async () => {
    const container = await containerWithArmy();
    await container.shadows.addExp("igris", 1_234, "2026-08-14");
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);
    await equipShadowSkin(container, "igris", "void");
    expect((await container.shadows.byId("igris"))?.exp).toBe(1_234);
  });
});
