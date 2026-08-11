import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { overrideQuestItem } from "./override-quest-item";

describe("overrideQuestItem", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed([{ id: "rulers-authority" }]);
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  });

  it("refuses without Ruler's Authority learned and equipped", async () => {
    const result = await overrideQuestItem(container, "squats", 5);
    expect(result).toEqual({
      ok: false,
      error: { type: "skill-not-equipped" },
    });
  });

  it("overrides today's target once the skill is equipped", async () => {
    await container.skills.learn("rulers-authority", 100);
    await container.skills.equip("rulers-authority", 100);
    const result = await overrideQuestItem(container, "squats", 5);
    expect(result.ok).toBe(true);
  });

  it("refuses a second override on the same day", async () => {
    await container.skills.learn("rulers-authority", 100);
    await container.skills.equip("rulers-authority", 100);
    await overrideQuestItem(container, "squats", 5);
    const second = await overrideQuestItem(container, "pushups", 10);
    expect(second).toEqual({
      ok: false,
      error: { type: "already-overridden-today" },
    });
  });
});
