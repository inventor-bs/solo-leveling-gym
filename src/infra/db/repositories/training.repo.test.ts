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

describe("window and history queries", () => {
  async function completedSession(
    id: string,
    day: string,
    startedAt: number,
    endedAt: number,
    sets: { exerciseId: string; reps: number; weight: number }[],
  ) {
    await repo.createSession({
      id,
      day,
      programDayId: "upper-a",
      startedAt,
    });
    let i = 0;
    for (const s of sets) {
      await repo.upsertSetLog({
        id: `${id}-set-${i}`,
        sessionId: id,
        exerciseId: s.exerciseId,
        setIndex: i,
        reps: s.reps,
        weight: s.weight,
        completed: true,
        isPr: false,
        loggedAt: startedAt,
      });
      i += 1;
    }
    await repo.completeSession(id, endedAt, "C");
  }

  it("completedSessionsBetween includes both endpoints and excludes what falls outside", async () => {
    await completedSession("s1", "2026-07-10", 1, 2, []);
    await completedSession("s2", "2026-07-11", 3, 4, []);
    await completedSession("s3", "2026-08-07", 5, 6, []);

    const rows = await repo.completedSessionsBetween(
      "2026-07-11",
      "2026-08-07",
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["s2", "s3"]);
  });

  it("REGRESSION: completedSessionsBetween ignores a session that was started but never finished", async () => {
    // An abandoned session is not training. Counting it would inflate both
    // the VIT stat and the schedule-adherence half of INT.
    await repo.createSession({
      id: "open",
      day: "2026-08-07",
      programDayId: "upper-a",
      startedAt: 1,
    });
    expect(
      await repo.completedSessionsBetween("2026-08-01", "2026-08-07"),
    ).toEqual([]);
  });

  it("runsBetween filters by day", async () => {
    await repo.createRun({
      id: "r1",
      day: "2026-07-01",
      distanceKm: 5,
      durationSec: 1800,
      loggedAt: 1,
    });
    await repo.createRun({
      id: "r2",
      day: "2026-08-05",
      distanceKm: 3,
      durationSec: 1000,
      loggedAt: 2,
    });
    const rows = await repo.runsBetween("2026-08-01", "2026-08-07");
    expect(rows.map((r) => r.id)).toEqual(["r2"]);
  });

  it("completedSessionStarts returns the start instant of every finished session", async () => {
    await completedSession("s1", "2026-08-05", 1000, 2000, []);
    await completedSession("s2", "2026-08-06", 3000, 4000, []);
    await repo.createSession({
      id: "open",
      day: "2026-08-07",
      programDayId: "upper-a",
      startedAt: 5000,
    });
    expect(await repo.completedSessionStarts()).toEqual([1000, 3000]);
  });

  it("completedSessionCountSince counts only sessions finished strictly after the instant", async () => {
    await completedSession("s1", "2026-08-05", 1000, 2000, []);
    await completedSession("s2", "2026-08-06", 3000, 4000, []);
    expect(await repo.completedSessionCountSince(0)).toBe(2);
    expect(await repo.completedSessionCountSince(2000)).toBe(1);
    expect(await repo.completedSessionCountSince(4000)).toBe(0);
  });

  it("e1rmHistory reports the best e1RM per completed session, newest day first", async () => {
    await completedSession("s1", "2026-07-01", 1, 2, [
      { exerciseId: "bench-press", reps: 5, weight: 80 },
    ]);
    await completedSession("s2", "2026-08-06", 3, 4, [
      { exerciseId: "bench-press", reps: 3, weight: 90 },
      { exerciseId: "bench-press", reps: 1, weight: 100 },
    ]);

    const history = await repo.e1rmHistory("bench-press");
    expect(history.map((h) => h.day)).toEqual(["2026-08-06", "2026-07-01"]);
    expect(history[0]?.e1rm).toBe(100); // the single at 100kg beats 90x3
  });

  it("REGRESSION: e1rmHistory drops days with no measurable e1RM", async () => {
    // Bodyweight work has no meaningful e1RM. A zero row would drag the
    // 4-week trend down as if the lift had collapsed.
    await completedSession("s1", "2026-08-06", 1, 2, [
      { exerciseId: "bench-press", reps: 20, weight: 0 },
    ]);
    expect(await repo.e1rmHistory("bench-press")).toEqual([]);
  });

  it("e1rmHistory is empty for an exercise that was never lifted", async () => {
    expect(await repo.e1rmHistory("deadlift")).toEqual([]);
  });
});

describe("dailyVolumeBetween", () => {
  it("sums volume per calendar day across completed sessions in range", async () => {
    await repo.createSession({
      id: "s1",
      day: "2026-07-20",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await repo.upsertSetLog({
      id: "s1-bench-press-0",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 5,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 1,
    });
    await repo.completeSession("s1", 2, "C");

    await repo.createSession({
      id: "s2",
      day: "2026-07-20",
      programDayId: "upper-a",
      startedAt: 3,
    });
    await repo.upsertSetLog({
      id: "s2-barbell-row-0",
      sessionId: "s2",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 50,
      completed: true,
      isPr: false,
      loggedAt: 3,
    });
    await repo.completeSession("s2", 4, "C");

    await repo.createSession({
      id: "s3",
      day: "2026-07-21",
      programDayId: "upper-a",
      startedAt: 5,
    });
    await repo.upsertSetLog({
      id: "s3-overhead-press-0",
      sessionId: "s3",
      exerciseId: "overhead-press",
      setIndex: 0,
      reps: 6,
      weight: 40,
      completed: true,
      isPr: false,
      loggedAt: 5,
    });
    await repo.completeSession("s3", 6, "C");

    const byDay = await repo.dailyVolumeBetween("2026-07-20", "2026-07-21");
    expect(byDay).toEqual(
      new Map([
        ["2026-07-20", 5 * 100 + 8 * 50],
        ["2026-07-21", 6 * 40],
      ]),
    );
  });

  it("REGRESSION: excludes a session with no endedAt — it hasn't happened yet", async () => {
    await repo.createSession({
      id: "s1",
      day: "2026-07-20",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await repo.upsertSetLog({
      id: "s1-bench-press-0",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 5,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 1,
    });
    await repo.completeSession("s1", 2, "C");

    await repo.createSession({
      id: "open",
      day: "2026-07-20",
      programDayId: "upper-a",
      startedAt: 3,
    });
    await repo.upsertSetLog({
      id: "open-bench-press-0",
      sessionId: "open",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 10,
      weight: 999,
      completed: true,
      isPr: false,
      loggedAt: 3,
    });

    const byDay = await repo.dailyVolumeBetween("2026-07-20", "2026-07-20");
    expect(byDay).toEqual(new Map([["2026-07-20", 5 * 100]]));
  });

  it("returns an empty map when nothing is in range", async () => {
    expect(await repo.dailyVolumeBetween("2020-01-01", "2020-01-31")).toEqual(
      new Map(),
    );
  });
});
