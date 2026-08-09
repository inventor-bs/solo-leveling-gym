import { describe, it, expect } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { EquipmentRepo } from "./equipment.repo";

async function repo() {
  return new EquipmentRepo(await makeTestDb());
}

describe("EquipmentRepo", () => {
  it("starts empty — nothing has dropped yet", async () => {
    const equipment = await repo();
    expect(await equipment.all()).toEqual([]);
    expect(await equipment.bySlot("weapon")).toBeNull();
  });

  it("stores a drop in its slot with its grade and instant", async () => {
    const equipment = await repo();
    await equipment.put("weapon", "rare", 1_234);
    const row = await equipment.bySlot("weapon");
    expect(row?.grade).toBe("rare");
    expect(row?.droppedAt).toBe(1_234);
  });

  it("holds at most one item per slot — a second drop replaces it", async () => {
    const equipment = await repo();
    await equipment.put("armor", "common", 1);
    await equipment.put("armor", "epic", 2);
    const rows = await equipment.all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.grade).toBe("epic");
    expect(rows[0]?.droppedAt).toBe(2);
  });

  it("keeps the three slots independent", async () => {
    const equipment = await repo();
    await equipment.put("weapon", "common", 1);
    await equipment.put("armor", "rare", 2);
    await equipment.put("accessory", "legendary", 3);
    const rows = await equipment.all();
    expect(rows.map((r) => r.slot).sort()).toEqual([
      "accessory",
      "armor",
      "weapon",
    ]);
  });
});
