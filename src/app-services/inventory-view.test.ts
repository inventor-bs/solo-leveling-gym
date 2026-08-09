import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { getInventoryView } from "./inventory-view";

async function container(): Promise<Container> {
  return buildContainer({
    db: await makeTestDb(),
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-09T05:00:00Z"),
  });
}

describe("getInventoryView", () => {
  it("always lists all three slots, empty or not", async () => {
    const view = await getInventoryView(await container());
    expect(view.map((s) => s.slot)).toEqual(["weapon", "armor", "accessory"]);
    expect(view.every((s) => s.grade === null)).toBe(true);
    expect(view.every((s) => s.bonusPercent === 0)).toBe(true);
  });

  it("names each slot's item whether or not anything has dropped", async () => {
    const view = await getInventoryView(await container());
    expect(view.map((s) => s.name)).toEqual([
      "Knight Killer",
      "Shadow Compression Gear",
      "Hunter's Charm",
    ]);
  });

  it("reports the grade and its percentage for a filled slot", async () => {
    const c = await container();
    await c.equipment.put("armor", "rare", c.clock.now());
    const armor = (await getInventoryView(c)).find((s) => s.slot === "armor");
    expect(armor?.grade).toBe("rare");
    expect(armor?.bonusPercent).toBe(15);
    expect(armor?.droppedDay).toBe("2026-08-09");
  });

  it("treats a grade the catalog does not name as an empty slot", async () => {
    const c = await container();
    await c.equipment.put("weapon", "mythic", 0);
    const weapon = (await getInventoryView(c)).find((s) => s.slot === "weapon");
    expect(weapon?.grade).toBeNull();
    expect(weapon?.bonusPercent).toBe(0);
  });
});
