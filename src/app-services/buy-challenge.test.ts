import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { buyChallenge } from "./buy-challenge";

async function containerWith(gold: number): Promise<Container> {
  const db = await makeTestDb();
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-09T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.hunters.update({ gold });
  return container;
}

describe("buyChallenge", () => {
  it("opens a Red Gate for 2500 gold and records it as pending", async () => {
    const container = await containerWith(3_000);
    const result = await buyChallenge(container, { type: "red-gate" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldRemaining).toBe(500);
    const pending = await container.store.pendingChallenge();
    expect(pending?.type).toBe("red-gate");
    expect(pending?.floor).toBeNull();
  });

  it("opens a Boss Raid for 4000 gold", async () => {
    const container = await containerWith(4_000);
    const result = await buyChallenge(container, { type: "boss-raid" });
    if (!result.ok) return;
    expect(result.value.goldRemaining).toBe(0);
    expect((await container.store.pendingChallenge())?.type).toBe("boss-raid");
  });

  it("opens floor 1 of the Demon Castle for 1500 gold and stores the floor", async () => {
    const container = await containerWith(1_500);
    const result = await buyChallenge(container, {
      type: "demon-castle",
      floor: 1,
    });
    expect(result.ok).toBe(true);
    expect((await container.store.pendingChallenge())?.floor).toBe(1);
  });

  it("refuses a floor that is not the next one up", async () => {
    const container = await containerWith(9_999);
    const result = await buyChallenge(container, {
      type: "demon-castle",
      floor: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("floor-locked");
    expect((await container.hunters.get())?.gold).toBe(9_999);
  });

  it("allows floor N once floor N-1 has actually been cleared", async () => {
    const container = await containerWith(9_999);
    await container.store.setHighestFloorCleared(1);
    const result = await buyChallenge(container, {
      type: "demon-castle",
      floor: 2,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a second challenge while one is still open", async () => {
    const container = await containerWith(9_999);
    await buyChallenge(container, { type: "red-gate" });
    const second = await buyChallenge(container, { type: "boss-raid" });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.type).toBe("challenge-already-pending");
    expect((await container.store.pendingChallenge())?.type).toBe("red-gate");
  });

  it("refuses when the gold is short, without opening anything", async () => {
    const container = await containerWith(2_499);
    const result = await buyChallenge(container, { type: "red-gate" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("insufficient-gold");
    expect(await container.store.pendingChallenge()).toBeNull();
  });

  it("stamps the purchase instant so the same-day rule can be enforced", async () => {
    const container = await containerWith(3_000);
    await buyChallenge(container, { type: "red-gate" });
    const pending = await container.store.pendingChallenge();
    expect(pending?.purchasedAt).toBe(container.clock.now());
  });
});
