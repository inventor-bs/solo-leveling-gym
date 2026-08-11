import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { swapWeeklySchedule } from "./swap-weekly-schedule";

describe("swapWeeklySchedule", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await container.skills.seed([{ id: "shadow-exchange" }]);
  });

  it("refuses without Shadow Exchange learned and equipped", async () => {
    const result = await swapWeeklySchedule(container, 1, 2);
    expect(result).toEqual({
      ok: false,
      error: { type: "skill-not-equipped" },
    });
  });

  it("swaps once per week", async () => {
    await container.skills.learn("shadow-exchange", 100);
    await container.skills.equip("shadow-exchange", 100);
    const result = await swapWeeklySchedule(container, 1, 2);
    expect(result.ok).toBe(true);
  });

  it("refuses a second swap in the same ISO week", async () => {
    await container.skills.learn("shadow-exchange", 100);
    await container.skills.equip("shadow-exchange", 100);
    await swapWeeklySchedule(container, 1, 2);
    const second = await swapWeeklySchedule(container, 3, 4);
    expect(second).toEqual({
      ok: false,
      error: { type: "already-swapped-this-week" },
    });
  });
});
