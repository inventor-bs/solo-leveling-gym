import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { SKILL_CATALOG } from "@/core/skill/catalog";
import { getSkillsView } from "./skills-view";

describe("getSkillsView", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed(SKILL_CATALOG.map((s) => ({ id: s.id })));
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({ level: 10, rank: "D" }); // 14 AP earned
  });

  it("reports total AP earned, spent and available", async () => {
    await container.skills.learn("tenacity", 100); // 3 AP
    const view = await getSkillsView(container);
    expect(view.apEarned).toBe(14);
    expect(view.apSpent).toBe(3);
    expect(view.apAvailable).toBe(11);
  });

  it("reports slot usage and capacity", async () => {
    await container.skills.learn("tenacity", 100);
    await container.skills.equip("tenacity", 100);
    const view = await getSkillsView(container);
    expect(view.slotsUsed).toBe(1);
    expect(view.slotCapacity).toBe(3);
  });

  it("lists every catalog skill with its learned/equipped status", async () => {
    await container.skills.learn("tenacity", 100);
    const view = await getSkillsView(container);
    expect(view.skills).toHaveLength(SKILL_CATALOG.length);
    const tenacity = view.skills.find((s) => s.id === "tenacity");
    expect(tenacity).toMatchObject({ learned: true, equipped: false });
    const untouched = view.skills.find((s) => s.id === "vital-strike");
    expect(untouched).toMatchObject({ learned: false, equipped: false });
  });
});
