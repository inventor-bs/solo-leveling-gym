import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import type { Db } from "@/infra/db/client";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { getLiftTrends } from "./lift-trends";

let db: Db;
let container: Container;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-07T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

async function lifted(
  id: string,
  day: string,
  exerciseId: string,
  reps: number,
  weight: number,
) {
  await container.training.createSession({
    id,
    day,
    programDayId: "upper-a",
    startedAt: 1,
  });
  await container.training.upsertSetLog({
    id: `${id}-set`,
    sessionId: id,
    exerciseId,
    setIndex: 0,
    reps,
    weight,
    completed: true,
    isPr: false,
    loggedAt: 1,
  });
  await container.training.completeSession(id, 2, "C");
}

describe("getLiftTrends", () => {
  it("is empty before anything has been lifted", async () => {
    expect(await getLiftTrends(container)).toEqual([]);
  });

  it("REGRESSION: lists only exercises with real history, not the whole catalog", async () => {
    // A table full of empty rows for 23 untouched exercises is noise, and
    // this page is a record of what was actually done.
    await lifted("s1", "2026-08-06", "bench-press", 1, 100);
    const trends = await getLiftTrends(container);
    expect(trends).toHaveLength(1);
    expect(trends[0]?.exerciseId).toBe("bench-press");
    expect(trends[0]?.name).toBe("Bench Press");
  });

  it("reports the current window, the PR, and the day the PR was set", async () => {
    await lifted("s1", "2026-08-06", "bench-press", 1, 100);
    const [entry] = await getLiftTrends(container);
    expect(entry?.currentE1rm).toBe(100);
    expect(entry?.previousE1rm).toBeNull();
    expect(entry?.deltaKg).toBeNull();
    expect(entry?.bestE1rm).toBe(100);
    expect(entry?.bestDay).toBe("2026-08-06");
  });

  it("compares the two 28-day windows", async () => {
    await lifted("old", "2026-07-04", "bench-press", 1, 90);
    await lifted("new", "2026-08-06", "bench-press", 1, 100);
    const [entry] = await getLiftTrends(container);
    expect(entry?.previousE1rm).toBe(90);
    expect(entry?.currentE1rm).toBe(100);
    expect(entry?.deltaKg).toBe(10);
  });

  it("sorts the heaviest lift first", async () => {
    await lifted("s1", "2026-08-06", "bench-press", 1, 100);
    await lifted("s2", "2026-08-06", "overhead-press", 1, 60);
    const trends = await getLiftTrends(container);
    expect(trends.map((t) => t.exerciseId)).toEqual([
      "bench-press",
      "overhead-press",
    ]);
  });
});
