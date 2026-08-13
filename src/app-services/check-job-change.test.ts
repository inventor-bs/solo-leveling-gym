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

  it("CRITICAL: a zero-volume call never opens a new attempt", async () => {
    const events = await checkJobChangeProgress(container, "2026-08-10", 0, 0);
    expect(events).toEqual([]);
    expect(await container.skills.jobChangeAttempt()).toBeNull();
  });

  it("CRITICAL: an active, unjudged Daily Quest is not read as a failure", async () => {
    // "active" is the status a quest carries before it's ever judged — the
    // caller's own quest for the same day it's calling with, in practice.
    await container.quests.create({
      id: "q1",
      day: "2026-08-10",
      rank: "A",
      targetPushups: 60,
      targetSitups: 60,
      targetSquats: 60,
      targetRunKm: 5,
      createdAt: 0,
    });
    const events = await checkJobChangeProgress(
      container,
      "2026-08-10",
      120,
      100,
    );
    expect(events.map((e) => e.type)).not.toContain("JobChangeFailed");
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.consecutiveCleared).toBe(1);
    expect(attempt?.failedAt).toBeNull();
  });

  it("CRITICAL: an ordinary zero-volume call leaves an active streak untouched", async () => {
    await checkJobChangeProgress(container, "2026-08-08", 120, 100); // -> 1
    await checkJobChangeProgress(container, "2026-08-09", 120, 100); // -> 2
    const before = await container.skills.jobChangeAttempt();
    expect(before?.consecutiveCleared).toBe(2);

    // The reset's own check-only call: no session, nothing missed, window
    // not elapsed. It must not overwrite the real streak with the 0
    // "nothing happened" naturally computes to.
    const events = await checkJobChangeProgress(container, "2026-08-10", 0, 0);
    expect(events).toEqual([]);
    const after = await container.skills.jobChangeAttempt();
    expect(after?.consecutiveCleared).toBe(2);
  });

  it("fails the attempt when a quest in the window is stored as actually missed", async () => {
    await checkJobChangeProgress(container, "2026-08-08", 120, 100);
    await container.quests.create({
      id: "q1",
      day: "2026-08-09",
      rank: "A",
      targetPushups: 60,
      targetSitups: 60,
      targetSquats: 60,
      targetRunKm: 5,
      createdAt: 0,
    });
    await container.quests.setStatus("2026-08-09", "missed", 1);
    const events = await checkJobChangeProgress(
      container,
      "2026-08-09",
      120,
      100,
    );
    expect(events.map((e) => e.type)).toContain("JobChangeFailed");
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.failedAt).not.toBeNull();
  });
});
