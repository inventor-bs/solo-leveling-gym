import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { getStoreView } from "./store-view";

async function containerAt(
  day: string,
  gold: number,
  level = 1,
): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock(`${day}T05:00:00Z`),
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

describe("getStoreView", () => {
  it("returns null before a Hunter exists", async () => {
    const db = await makeTestDb();
    const container = buildContainer({ db, tzOffsetMinutes: 420 });
    expect(await getStoreView(container)).toBeNull();
  });

  it("reports the gold on hand and marks what is affordable", async () => {
    const view = await getStoreView(await containerAt("2026-08-09", 1_300));
    expect(view?.gold).toBe(1_300);
    const amrap = view?.unlocks.find((u) => u.key === "dungeon-type:amrap");
    expect(amrap?.affordable).toBe(true);
    const ppl = view?.unlocks.find((u) => u.key === "program:ppl");
    expect(ppl?.affordable).toBe(false);
  });

  it("marks a level-gated program unavailable below its level", async () => {
    const view = await getStoreView(
      await containerAt("2026-08-09", 99_999, 19),
    );
    const ppl = view?.unlocks.find((u) => u.key === "program:ppl");
    expect(ppl?.requirementMet).toBe(false);
    expect(ppl?.available).toBe(false);
  });

  it("marks an already-bought unlock as owned and no longer available", async () => {
    const container = await containerAt("2026-08-09", 99_999);
    await container.store.unlock("dungeon-type:amrap", 0);
    const view = await getStoreView(container);
    const amrap = view?.unlocks.find((u) => u.key === "dungeon-type:amrap");
    expect(amrap?.unlocked).toBe(true);
    expect(amrap?.available).toBe(false);
  });

  it("prices the three challenges and reports the next castle floor", async () => {
    const container = await containerAt("2026-08-09", 99_999);
    await container.store.setHighestFloorCleared(2);
    const view = await getStoreView(container);
    expect(view?.challenges.map((c) => c.cost)).toEqual([2_500, 4_000, 1_500]);
    expect(view?.highestFloorCleared).toBe(2);
    expect(
      view?.challenges.find((c) => c.type === "demon-castle")?.nextFloor,
    ).toBe(3);
  });

  it("blocks every challenge while one is already open, and says why", async () => {
    const container = await containerAt("2026-08-09", 99_999);
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: 1,
      floor: null,
    });
    const view = await getStoreView(container);
    expect(view?.pendingChallenge?.type).toBe("red-gate");
    for (const challenge of view?.challenges ?? []) {
      expect(challenge.available).toBe(false);
    }
  });

  it("offers the wager only on a Monday, with the cap it will enforce", async () => {
    const monday = await getStoreView(await containerAt("2026-08-10", 1_000));
    expect(monday?.wager.available).toBe(true);
    expect(monday?.wager.maxStake).toBe(500);

    const tuesday = await getStoreView(await containerAt("2026-08-11", 1_000));
    expect(tuesday?.wager.available).toBe(false);
  });

  it("closes the wager once this week's stake is already placed", async () => {
    const container = await containerAt("2026-08-10", 1_000);
    await container.wagers.place({
      weekStart: "2026-08-10",
      stakeGold: 100,
      placedAt: 1,
    });
    const view = await getStoreView(container);
    expect(view?.wager.available).toBe(false);
    expect(view?.wager.placedStake).toBe(100);
  });

  it("closes the Hourglass once one has been used this week", async () => {
    const container = await containerAt("2026-08-06", 99_999);
    await container.mitigation.grantGrace("2026-08-03", 1);
    const view = await getStoreView(container);
    expect(view?.mitigation.find((m) => m.key === "hourglass")?.available).toBe(
      false,
    );
  });

  it("lists only extracted shadows as feedable", async () => {
    const view = await getStoreView(await containerAt("2026-08-09", 99_999));
    expect(view?.feedableShadows.map((s) => s.id)).toEqual(["igris"]);
  });
});
