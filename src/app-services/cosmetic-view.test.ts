import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import {
  AURA_VISUAL_MAX_LEVEL,
  VOICE_OF_THE_RULER_COST,
} from "@/core/economy/pricing";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  shadowSkinKey,
  titleFrameKey,
} from "@/core/cosmetic/catalog";
import { VOICE_OF_THE_RULER_UNLOCK_KEY } from "@/core/system-voice/tone";
import { getCosmeticView } from "./cosmetic-view";

async function containerWith(gold: number, auraLevel = 0): Promise<Container> {
  const db = await makeTestDb();
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-14T05:00:00Z"),
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold, auraLevel });
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

describe("getCosmeticView", () => {
  it("returns null before a hunter exists", async () => {
    const db = await makeTestDb();
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-14T05:00:00Z"),
    });
    expect(await getCosmeticView(container)).toBeNull();
  });

  it("marks the dashboard layout unbought, affordable and available", async () => {
    const view = await getCosmeticView(await containerWith(1_000));
    expect(view?.dashboardLayout).toMatchObject({
      key: DASHBOARD_LAYOUT_UNLOCK_KEY,
      cost: 500,
      owned: false,
      affordable: true,
      available: true,
    });
  });

  it("marks an owned item unavailable rather than merely unaffordable", async () => {
    const container = await containerWith(10_000);
    await container.store.unlock(DASHBOARD_LAYOUT_UNLOCK_KEY, 0);
    const view = await getCosmeticView(container);
    expect(view?.dashboardLayout.owned).toBe(true);
    expect(view?.dashboardLayout.available).toBe(false);
  });

  it("marks an unaffordable item unavailable", async () => {
    const view = await getCosmeticView(await containerWith(10));
    expect(view?.dashboardLayout.affordable).toBe(false);
    expect(view?.dashboardLayout.available).toBe(false);
  });

  it("offers each skin only for shadows that have actually been extracted", async () => {
    const view = await getCosmeticView(await containerWith(10_000));
    const ember = view?.skins.find((s) => s.skinId === "ember");
    // The roster starts with Igris alone extracted.
    expect(ember?.shadows.map((s) => s.shadowId)).toEqual(["igris"]);
    expect(ember?.shadows[0]).toMatchObject({
      shadowName: "Igris",
      owned: false,
      available: true,
    });
  });

  it("marks one owned pair without marking the same skin on another shadow", async () => {
    const container = await containerWith(10_000);
    await container.shadows.extract("tank", 1);
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);

    const view = await getCosmeticView(container);
    const voidSkin = view?.skins.find((s) => s.skinId === "void");
    expect(voidSkin?.shadows.find((s) => s.shadowId === "igris")?.owned).toBe(
      true,
    );
    expect(voidSkin?.shadows.find((s) => s.shadowId === "tank")?.owned).toBe(
      false,
    );
  });

  it("reports what each extracted shadow owns and wears", async () => {
    const container = await containerWith(10_000);
    await container.store.unlock(shadowSkinKey("void", "igris"), 0);
    await container.store.unlock(shadowSkinKey("ember", "igris"), 0);
    await container.shadows.equipSkin("igris", "void");

    const view = await getCosmeticView(container);
    expect(view?.shadowSkins).toEqual([
      {
        shadowId: "igris",
        shadowName: "Igris",
        equippedSkinId: "void",
        ownedSkinIds: ["ember", "void"],
      },
    ]);
  });

  it("reports frame ownership and what is worn", async () => {
    const container = await containerWith(10_000);
    await container.store.unlock(titleFrameKey("monarch"), 0);
    await container.hunters.update({ titleFrame: "monarch" });

    const view = await getCosmeticView(container);
    expect(view?.frames.find((f) => f.frameId === "monarch")).toMatchObject({
      owned: true,
      equipped: true,
      available: false,
    });
    expect(view?.equippedFrameId).toBe("monarch");
  });

  it("ignores a worn frame that is not owned", async () => {
    // A value left behind by a hand edit must not render as if it were bought.
    const container = await containerWith(10_000);
    await container.hunters.update({ titleFrame: "sovereign" });
    const view = await getCosmeticView(container);
    expect(view?.equippedFrameId).toBeNull();
  });

  it("ignores a worn frame that is not even a real frame id", async () => {
    const container = await containerWith(10_000);
    await container.hunters.update({ titleFrame: "bronze" });
    expect((await getCosmeticView(container))?.equippedFrameId).toBeNull();
  });

  it("quotes the next aura price from the stored level and flags saturation", async () => {
    const belowCap = await getCosmeticView(await containerWith(100_000, 2));
    expect(belowCap?.aura).toMatchObject({
      level: 2,
      visualTier: 2,
      nextCost: 6_750,
      saturated: false,
      affordable: true,
    });

    const atCap = await getCosmeticView(
      await containerWith(100_000, AURA_VISUAL_MAX_LEVEL + 3),
    );
    expect(atCap?.aura.visualTier).toBe(AURA_VISUAL_MAX_LEVEL);
    expect(atCap?.aura.saturated).toBe(true);
  });
});

describe("getCosmeticView — voice of the ruler", () => {
  it("offers the bundle at one price when it is affordable and unbought", async () => {
    const view = await getCosmeticView(await containerWith(5_000));
    expect(view?.voiceTone).toMatchObject({
      owned: false,
      cost: VOICE_OF_THE_RULER_COST,
      affordable: true,
      available: true,
      active: null,
    });
  });

  it("is unaffordable rather than available when the gold is short", async () => {
    const view = await getCosmeticView(
      await containerWith(VOICE_OF_THE_RULER_COST - 1),
    );
    expect(view?.voiceTone.affordable).toBe(false);
    expect(view?.voiceTone.available).toBe(false);
  });

  it("marks an owned bundle unavailable rather than merely unaffordable", async () => {
    const container = await containerWith(50_000);
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    const view = await getCosmeticView(container);
    expect(view?.voiceTone.owned).toBe(true);
    expect(view?.voiceTone.available).toBe(false);
  });

  it("lists four options — Cold first, then the three that are bought", async () => {
    const view = await getCosmeticView(await containerWith(5_000));
    expect(view?.voiceTone.options.map((o) => o.toneId)).toEqual([
      null,
      "mocking",
      "ancient",
      "merciless",
    ]);
    expect(view?.voiceTone.options[0]?.name).toBe("Cold");
  });

  it("shows a sample line for every option, bought or not, so the price is an informed choice", async () => {
    const view = await getCosmeticView(await containerWith(0));
    expect(view?.voiceTone.owned).toBe(false);
    for (const option of view?.voiceTone.options ?? []) {
      expect(option.sample.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });

  it("marks Cold active until something else is chosen and owned", async () => {
    const view = await getCosmeticView(await containerWith(5_000));
    expect(view?.voiceTone.options.find((o) => o.active)?.toneId).toBeNull();
  });

  it("marks the chosen tone active once it is both chosen and owned", async () => {
    const container = await containerWith(5_000);
    await container.store.unlock(VOICE_OF_THE_RULER_UNLOCK_KEY, 0);
    await container.hunters.update({ voiceTone: "ancient" });

    const view = await getCosmeticView(container);
    expect(view?.voiceTone.active).toBe("ancient");
    expect(view?.voiceTone.options.filter((o) => o.active)).toHaveLength(1);
    expect(view?.voiceTone.options.find((o) => o.active)?.toneId).toBe(
      "ancient",
    );
  });

  it("REGRESSION: reports Cold as active when the tone is chosen but the unlock is gone", async () => {
    // The Store must never show a voice as selected that the System is not
    // actually speaking in — which is why this view asks the one resolver
    // rather than reading the column itself.
    const container = await containerWith(5_000);
    await container.hunters.update({ voiceTone: "ancient" });

    const view = await getCosmeticView(container);
    expect(view?.voiceTone.active).toBeNull();
    expect(view?.voiceTone.options.find((o) => o.active)?.toneId).toBeNull();
  });
});
