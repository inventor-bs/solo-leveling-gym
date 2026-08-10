import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { SKILL_CATALOG } from "@/core/skill/catalog";
import { learnSkill } from "./learn-skill";

describe("learnSkill", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed(SKILL_CATALOG.map((s) => ({ id: s.id })));
    // tenacity costs 3 AP; level 5 at rank E earns 4 AP (see ability-points.test.ts).
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({ level: 5, rank: "E" });
  });

  it("learns a skill the hunter has enough AP for", async () => {
    const result = await learnSkill(container, "tenacity");
    expect(result.ok).toBe(true);
    const row = await container.skills.byId("tenacity");
    expect(row?.learnedAt).not.toBeNull();
  });

  it("refuses an unknown skill id", async () => {
    const result = await learnSkill(container, "not-a-skill");
    expect(result).toEqual({ ok: false, error: { type: "unknown-skill" } });
  });

  it("refuses to learn the same skill twice", async () => {
    await learnSkill(container, "tenacity");
    const result = await learnSkill(container, "tenacity");
    expect(result).toEqual({ ok: false, error: { type: "already-learned" } });
  });

  it("refuses when AP available is less than the skill's cost", async () => {
    // vital-strike costs 6 AP; level 5/E only earns 4.
    const result = await learnSkill(container, "vital-strike");
    expect(result).toEqual({ ok: false, error: { type: "insufficient-ap" } });
  });

  it("insufficient-ap accounts for AP already spent on other skills", async () => {
    await container.hunters.update({ level: 10, rank: "D" }); // 14 AP earned
    await learnSkill(container, "vital-strike"); // 6 AP spent, 8 left
    await learnSkill(container, "iron-body"); // 5 AP spent, 3 left
    const result = await learnSkill(container, "shadow-preservation"); // needs 3 — should pass
    expect(result.ok).toBe(true);
    const second = await learnSkill(container, "advanced-regeneration"); // needs 4, 0 left
    expect(second).toEqual({ ok: false, error: { type: "insufficient-ap" } });
  });
});
