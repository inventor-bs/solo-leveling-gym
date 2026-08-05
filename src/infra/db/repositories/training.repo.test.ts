import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { seedProgram } from "../seed/program";
import { TrainingRepo } from "./training.repo";
import type { Db } from "../client";

let db: Db;
let repo: TrainingRepo;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  repo = new TrainingRepo(db);
});

async function loggedSession(
  id: string,
  endedAt: number | null,
  sets: {
    exerciseId: string;
    setIndex: number;
    reps: number;
    weight: number;
  }[],
) {
  await repo.createSession({
    id,
    day: "2026-08-05",
    programDayId: "upper-a",
    startedAt: 1000,
  });
  for (const s of sets) {
    await repo.upsertSetLog({
      id: `${id}-${s.exerciseId}-${s.setIndex}`,
      sessionId: id,
      exerciseId: s.exerciseId,
      setIndex: s.setIndex,
      reps: s.reps,
      weight: s.weight,
      completed: true,
      isPr: false,
      loggedAt: 1000,
    });
  }
  if (endedAt !== null) await repo.completeSession(id, endedAt, "C");
}

describe("TrainingRepo — session lifecycle", () => {
  it("createSession then getSession round-trips", async () => {
    const s = await repo.createSession({
      id: "s1",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 1000,
    });
    expect(s.endedAt).toBeNull();
    expect((await repo.getSession("s1"))?.programDayId).toBe("upper-a");
  });

  it("completeSession sets endedAt and rank", async () => {
    await repo.createSession({
      id: "s1",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 1000,
    });
    await repo.completeSession("s1", 2000, "B");
    const s = await repo.getSession("s1");
    expect(s?.endedAt).toBe(2000);
    expect(s?.rank).toBe("B");
  });
});

describe("TrainingRepo — set logging", () => {
  it("upsertSetLog inserts a new set", async () => {
    await repo.createSession({
      id: "s1",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 1000,
    });
    await repo.upsertSetLog({
      id: "set1",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 1000,
    });
    const sets = await repo.getSetsForSession("s1");
    expect(sets).toHaveLength(1);
    expect(sets[0]?.weight).toBe(80);
  });

  it("REGRESSION: upserting the same (session, exercise, setIndex) again updates, not duplicates", async () => {
    await repo.createSession({
      id: "s1",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 1000,
    });
    await repo.upsertSetLog({
      id: "set1",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 1000,
    });
    await repo.upsertSetLog({
      id: "set1-retry",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 7,
      weight: 82.5,
      completed: true,
      isPr: false,
      loggedAt: 1001,
    });
    const sets = await repo.getSetsForSession("s1");
    expect(sets).toHaveLength(1);
    expect(sets[0]?.reps).toBe(7);
    expect(sets[0]?.weight).toBe(82.5);
  });
});

describe("TrainingRepo — history for overload suggestions", () => {
  it("getExercisePerformanceHistory returns completed sessions, most recent first", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 80 },
    ]);
    await loggedSession("s2", 2000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 82.5 },
    ]);

    const history = await repo.getExercisePerformanceHistory("bench-press", 2);
    expect(history).toHaveLength(2);
    expect(history[0]?.weight).toBe(82.5); // most recent first
    expect(history[1]?.weight).toBe(80);
  });

  it("respects the limit", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 80 },
    ]);
    await loggedSession("s2", 2000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 82.5 },
    ]);
    await loggedSession("s3", 3000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 85 },
    ]);

    const history = await repo.getExercisePerformanceHistory("bench-press", 2);
    expect(history).toHaveLength(2);
    expect(history[0]?.weight).toBe(85);
  });

  it("excludes a given session id", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 80 },
    ]);
    await loggedSession("s2", 2000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 82.5 },
    ]);

    const history = await repo.getExercisePerformanceHistory(
      "bench-press",
      5,
      "s2",
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.weight).toBe(80);
  });

  it("ignores an in-progress (uncompleted) session", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 80 },
    ]);
    await loggedSession("s2", null, [
      { exerciseId: "bench-press", setIndex: 0, reps: 8, weight: 999 },
    ]);

    const history = await repo.getExercisePerformanceHistory("bench-press", 5);
    expect(history).toHaveLength(1);
    expect(history[0]?.weight).toBe(80);
  });
});

describe("TrainingRepo — bestHistoricalE1rm", () => {
  it("returns 0 with no history", async () => {
    expect(await repo.bestHistoricalE1rm("bench-press")).toBe(0);
  });

  it("returns the best e1RM across completed sessions", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 80 },
    ]);
    await loggedSession("s2", 2000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 75 },
    ]);
    // e1RM(80,6) = 96, e1RM(75,6) = 90 -> best is 96
    expect(await repo.bestHistoricalE1rm("bench-press")).toBe(96);
  });

  it("excludes the given session", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 80 },
    ]);
    expect(await repo.bestHistoricalE1rm("bench-press", "s1")).toBe(0);
  });
});

describe("TrainingRepo — getRecentSessionVolumes", () => {
  it("returns volumes of completed sessions, most recent first", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 80 },
    ]); // 480
    await loggedSession("s2", 2000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 100 },
    ]); // 600

    const volumes = await repo.getRecentSessionVolumes(8);
    expect(volumes).toEqual([600, 480]);
  });

  it("excludes an in-progress session", async () => {
    await loggedSession("s1", 1000, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 80 },
    ]);
    await loggedSession("s2", null, [
      { exerciseId: "bench-press", setIndex: 0, reps: 6, weight: 999 },
    ]);

    expect(await repo.getRecentSessionVolumes(8)).toEqual([480]);
  });
});

describe("TrainingRepo — run logging", () => {
  it("createRun persists a run", async () => {
    const r = await repo.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1800,
      loggedAt: 1000,
    });
    expect(r.distanceKm).toBe(5);
  });
});
