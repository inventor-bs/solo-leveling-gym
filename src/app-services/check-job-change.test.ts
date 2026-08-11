import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { buildContainer, type Container } from "@/server/container";
import { checkJobChangeProgress } from "./check-job-change";

describe("checkJobChangeProgress", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-10T00:00:00Z"),
    });
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.hunters.update({ level: 40, rank: "A" });
  });

  it("does nothing below level 40", async () => {
    await container.hunters.update({ level: 39 });
    const events = await checkJobChangeProgress(
      container,
      "2026-08-10",
      120,
      100,
    );
    expect(events).toEqual([]);
    expect(await container.skills.jobChangeAttempt()).toBeNull();
  });

  it("starts a new attempt the first time an eligible session completes", async () => {
    await checkJobChangeProgress(container, "2026-08-10", 120, 100); // ratio 1.2, meets target
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.consecutiveCleared).toBe(1);
  });

  it("completes on the 3rd consecutive cleared dungeon and assigns a class", async () => {
    await checkJobChangeProgress(container, "2026-08-08", 120, 100);
    await checkJobChangeProgress(container, "2026-08-09", 120, 100);
    const events = await checkJobChangeProgress(
      container,
      "2026-08-10",
      120,
      100,
    );
    expect(events.some((e) => e.type === "ClassAssigned")).toBe(true);
    expect((await container.hunters.get())?.className).not.toBeNull();
  });

  it("resets the streak on a session below the volume ratio", async () => {
    await checkJobChangeProgress(container, "2026-08-08", 120, 100);
    await checkJobChangeProgress(container, "2026-08-09", 90, 100); // ratio 0.9, misses
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.consecutiveCleared).toBe(0);
  });

  it("does nothing once already classed", async () => {
    await checkJobChangeProgress(container, "2026-08-08", 120, 100);
    await checkJobChangeProgress(container, "2026-08-09", 120, 100);
    await checkJobChangeProgress(container, "2026-08-10", 120, 100); // completes
    const events = await checkJobChangeProgress(
      container,
      "2026-08-11",
      120,
      100,
    );
    expect(events).toEqual([]);
  });
});
