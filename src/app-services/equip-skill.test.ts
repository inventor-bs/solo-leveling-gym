import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { SKILL_CATALOG } from "@/core/skill/catalog";
import { equipSkill } from "./equip-skill";

describe("equipSkill", () => {
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

  it("refuses to equip a skill that has not been learned", async () => {
    const result = await equipSkill(container, "tenacity", true);
    expect(result).toEqual({ ok: false, error: { type: "not-learned" } });
  });

  it("equips a learned skill", async () => {
    await container.skills.learn("tenacity", 100);
    const result = await equipSkill(container, "tenacity", true);
    expect(result.ok).toBe(true);
    expect(await container.skills.equippedIds()).toEqual(["tenacity"]);
  });

  it("unequips a currently-equipped skill", async () => {
    await container.skills.learn("tenacity", 100);
    await equipSkill(container, "tenacity", true);
    await equipSkill(container, "tenacity", false);
    expect(await container.skills.equippedIds()).toEqual([]);
  });

  it("refuses to equip past the current slot capacity", async () => {
    const ids: (typeof SKILL_CATALOG)[number]["id"][] = [
      "tenacity",
      "advanced-regeneration",
      "iron-body",
    ];
    for (const id of ids) {
      await container.skills.learn(id, 100);
      const result = await equipSkill(container, id, true);
      expect(result.ok).toBe(true); // base capacity is 3 — all three fit
    }
    await container.skills.learn("vital-strike", 100);
    const fourth = await equipSkill(container, "vital-strike", true);
    expect(fourth).toEqual({ ok: false, error: { type: "no-free-slot" } });
  });
});
