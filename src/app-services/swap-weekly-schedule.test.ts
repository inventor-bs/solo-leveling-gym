import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import { swapWeeklySchedule } from "./swap-weekly-schedule";

describe("swapWeeklySchedule", () => {
  let container: Container;

  // The seeded program lifts on ISO weekdays 1, 3, 5 and 6 — every test
  // below that reaches the base-schedule validation needs a real schedule
  // to validate against.
  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-10T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await seedProgram(db);
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
    // Monday (1) is scheduled, Tuesday (2) is not — a genuine move.
    const result = await swapWeeklySchedule(container, 1, 2);
    expect(result.ok).toBe(true);
  });

  it("refuses a second swap in the same ISO week", async () => {
    await container.skills.learn("shadow-exchange", 100);
    await container.skills.equip("shadow-exchange", 100);
    await swapWeeklySchedule(container, 1, 2);
    // Wednesday (3) is scheduled, Thursday (4) is not — passes the
    // base-schedule validation, then is caught by the once-per-week guard.
    const second = await swapWeeklySchedule(container, 3, 4);
    expect(second).toEqual({
      ok: false,
      error: { type: "already-swapped-this-week" },
    });
  });

  describe("with Shadow Exchange equipped", () => {
    beforeEach(async () => {
      await container.skills.learn("shadow-exchange", 100);
      await container.skills.equip("shadow-exchange", 100);
    });

    it("refuses to swap a scheduled day for another day already scheduled — that would delete a day, not move it", async () => {
      // The seeded program lifts on 1, 3, 5, 6. Moving Wednesday (3) onto
      // Friday (5), which is already scheduled, would collapse the week to
      // three days instead of moving one.
      const result = await swapWeeklySchedule(container, 3, 5);
      expect(result).toEqual({
        ok: false,
        error: { type: "weekday-to-already-scheduled" },
      });
    });

    it("refuses to swap a day that isn't part of the schedule in the first place", async () => {
      // Tuesday (2) is not one of the seeded 1/3/5/6 weekdays.
      const result = await swapWeeklySchedule(container, 2, 4);
      expect(result).toEqual({
        ok: false,
        error: { type: "weekday-from-not-scheduled" },
      });
    });

    it("still allows a genuine move — a scheduled day onto a real day off", async () => {
      // Wednesday (3) is scheduled; Sunday (7) is not.
      const result = await swapWeeklySchedule(container, 3, 7);
      expect(result.ok).toBe(true);
    });
  });
});
