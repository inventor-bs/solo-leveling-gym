import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import type { Db } from "@/infra/db/client";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { deriveStats } from "@/core/hunter/stats";
import { buildStatInput, STAT_WINDOW_DAYS } from "./stat-input";

let db: Db;
let container: Container;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    // 09:00 ICT on 2026-08-07.
    clock: fixedClock("2026-08-07T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

async function completedSession(
  id: string,
  day: string,
  sets: { exerciseId: string; reps: number; weight: number }[],
) {
  await container.training.createSession({
    id,
    day,
    programDayId: "upper-a",
    startedAt: 1,
  });
  let i = 0;
  for (const s of sets) {
    await container.training.upsertSetLog({
      id: `${id}-${i}`,
      sessionId: id,
      exerciseId: s.exerciseId,
      setIndex: i,
      reps: s.reps,
      weight: s.weight,
      completed: true,
      isPr: false,
      loggedAt: 1,
    });
    i += 1;
  }
  await container.training.completeSession(id, 2, "C");
}

describe("buildStatInput", () => {
  it("uses a 28-day window", () => {
    expect(STAT_WINDOW_DAYS).toBe(28);
  });

  it("reports zeroes for a hunter who has done nothing", async () => {
    const input = await buildStatInput(container);
    expect(input.volume28d).toBe(0);
    expect(input.km28d).toBe(0);
    expect(input.avgPaceSecPerKm).toBeNull();
    expect(input.sessionsCompleted28d).toBe(0);
    expect(input.setsCompleted28d).toBe(0);
    expect(input.setsPlanned28d).toBe(0);
    expect(input.streakDays).toBe(0);
  });

  it("lists exactly the five main lifts, at zero before anything is lifted", async () => {
    const input = await buildStatInput(container);
    expect([...input.mainLiftE1rms.keys()].sort()).toEqual([
      "back-squat",
      "barbell-row",
      "bench-press",
      "deadlift",
      "overhead-press",
    ]);
    expect([...input.mainLiftE1rms.values()].every((v) => v === 0)).toBe(true);
  });

  it("REGRESSION: hiddenQuestsFound is zero — Hidden Quests do not exist yet", async () => {
    // A number nobody can produce must not be invented. Every other field
    // here traces to a real row.
    const input = await buildStatInput(container);
    expect(input.hiddenQuestsFound).toBe(0);
  });

  it("counts volume, sets and sessions from completed sessions inside the window", async () => {
    await completedSession("s1", "2026-08-06", [
      { exerciseId: "bench-press", reps: 6, weight: 80 },
      { exerciseId: "bench-press", reps: 5, weight: 80 },
    ]);
    const input = await buildStatInput(container);
    expect(input.sessionsCompleted28d).toBe(1);
    expect(input.setsCompleted28d).toBe(2);
    expect(input.volume28d).toBe(6 * 80 + 5 * 80);
    expect(input.mainLiftE1rms.get("bench-press")).toBeGreaterThan(80);
  });

  it("REGRESSION: a session outside the window is excluded from the 28-day numbers", async () => {
    await completedSession("old", "2026-01-01", [
      { exerciseId: "bench-press", reps: 6, weight: 80 },
    ]);
    const input = await buildStatInput(container);
    expect(input.sessionsCompleted28d).toBe(0);
    expect(input.volume28d).toBe(0);
    // The all-time best still counts toward STR — that field is not windowed.
    expect(input.mainLiftE1rms.get("bench-press")).toBeGreaterThan(80);
  });

  it("counts planned sets from the program day each session belongs to", async () => {
    await completedSession("s1", "2026-08-06", [
      { exerciseId: "bench-press", reps: 6, weight: 80 },
    ]);
    const program = await container.programs.byId("upper-a");
    const planned = (program?.exercises ?? []).reduce(
      (sum, e) => sum + e.slot.targetSets,
      0,
    );
    const input = await buildStatInput(container);
    expect(planned).toBeGreaterThan(0);
    expect(input.setsPlanned28d).toBe(planned);
  });

  it("counts scheduled sessions from the weekly program, not from what was done", async () => {
    // Four lifting weekdays across a 28-day window is exactly 16 gates.
    const input = await buildStatInput(container);
    expect(input.sessionsScheduled28d).toBe(16);
  });

  it("derives distance and pace from the runs inside the window", async () => {
    await container.training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1500,
      loggedAt: 1,
    });
    await container.training.createRun({
      id: "r-old",
      day: "2026-01-01",
      distanceKm: 99,
      durationSec: 99,
      loggedAt: 1,
    });
    const input = await buildStatInput(container);
    expect(input.km28d).toBe(5);
    expect(input.avgPaceSecPerKm).toBe(300);
  });

  it("feeds Daily Quest adherence into the quest half of INT", async () => {
    for (const [day, status] of [
      ["2026-08-05", "completed"],
      ["2026-08-06", "missed"],
    ] as const) {
      await container.quests.create({
        id: `q-${day}`,
        day,
        rank: "E",
        targetPushups: 20,
        targetSitups: 20,
        targetSquats: 20,
        targetRunKm: 1,
        createdAt: 1,
      });
      await container.quests.setStatus(day, status, 1);
    }
    const input = await buildStatInput(container);
    expect(input.sideQuestsIssued28d).toBe(2);
    expect(input.sideQuestsCompleted28d).toBe(1);
  });

  it("feeds deriveStats without any further massaging", async () => {
    await completedSession("s1", "2026-08-06", [
      { exerciseId: "bench-press", reps: 6, weight: 80 },
    ]);
    const stats = deriveStats(await buildStatInput(container));
    expect(stats.strength).toBeGreaterThan(0);
    expect(stats.vitality).toBeGreaterThan(0);
  });
});
