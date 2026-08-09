import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { buyHourglassOfGrace } from "./buy-hourglass";

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
  return container;
}

describe("buyHourglassOfGrace", () => {
  it("charges 1000 gold and grants grace for today", async () => {
    const container = await containerAt("2026-08-06", 1_500);
    const result = await buyHourglassOfGrace(container);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.day).toBe("2026-08-06");
    expect(result.value.goldRemaining).toBe(500);
    expect(await container.mitigation.graceForDay("2026-08-06")).not.toBeNull();
  });

  it("names the item as the source on the GoldSpent event", async () => {
    const container = await containerAt("2026-08-06", 1_500);
    const result = await buyHourglassOfGrace(container);
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "GoldSpent",
      amount: 1_000,
      source: "hourglass-of-grace",
    });
  });

  it("refuses a second purchase on the same day", async () => {
    const container = await containerAt("2026-08-06", 5_000);
    await buyHourglassOfGrace(container);
    const again = await buyHourglassOfGrace(container);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.type).toBe("hourglass-already-active");
    expect((await container.hunters.get())?.gold).toBe(4_000);
  });

  it("refuses a second purchase later in the same week", async () => {
    const container = await containerAt("2026-08-06", 5_000);
    // A grace already used on the Monday of this week.
    await container.mitigation.grantGrace("2026-08-03", 1);
    const result = await buyHourglassOfGrace(container);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("hourglass-already-used-this-week");
    expect((await container.hunters.get())?.gold).toBe(5_000);
  });

  it("allows a purchase once the week has turned over", async () => {
    const container = await containerAt("2026-08-10", 5_000);
    await container.mitigation.grantGrace("2026-08-06", 1);
    expect((await buyHourglassOfGrace(container)).ok).toBe(true);
  });

  it("refuses when the gold is short", async () => {
    const container = await containerAt("2026-08-06", 999);
    const result = await buyHourglassOfGrace(container);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("insufficient-gold");
  });
});
