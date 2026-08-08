import { describe, it, expect, beforeEach } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { trainingDayStart, type TrainingDay } from "@/core/shared/training-day";
import { kg } from "@/core/shared/units";
import { getChronicleView } from "./chronicle-view";

let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-08T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
});

describe("getChronicleView", () => {
  it("returns a 365-cell heatmap ending today, empty timeline, and zeroed charts on an untouched hunter", async () => {
    const view = await getChronicleView(container);
    expect(view.heatmap).toHaveLength(365);
    expect(view.heatmap[364]!.day).toBe("2026-08-08");
    expect(view.timeline).toEqual([]);
    expect(view.weeklyVolume.every((w) => w.volume === 0)).toBe(true);
  });

  it("reflects a completed session's volume in the heatmap, weekly volume, and muscle breakdown", async () => {
    await container.training.createSession({
      id: "session-1",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "set-1",
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    // completeSession is out of this task's scope to call directly here —
    // use container.training.completeSession to stamp endedAt, matching
    // how other read-model tests in this codebase set up "a finished
    // session" without going through the full app-service.
    await container.training.completeSession("session-1", 1000, "C");

    const view = await getChronicleView(container);
    const day = view.heatmap.find((c) => c.day === "2026-08-05")!;
    expect(day.volume).toBe(480); // 6 reps x 80kg
    expect(view.weeklyVolume.some((w) => w.volume > 0)).toBe(true);
    expect(view.muscleVolume.chest).toBe(480);
  });

  it("resolves a persisted PrAchieved event's exercise id to a real name in the timeline", async () => {
    await container.events.record(
      [
        {
          type: "PrAchieved",
          exerciseId: "bench-press",
          newE1rm: kg(82.5),
          previousE1rm: kg(75),
        },
      ],
      "2026-08-05" as TrainingDay,
      1000,
    );
    const view = await getChronicleView(container);
    expect(view.timeline[0]!.summary).toBe("Bench Press 82.5 kg");
  });

  it("marks a heatmap day red for a closed penalty episode inside the window", async () => {
    // trainingDayStart gives the exact instant of local midnight on that
    // day, so closing the episode there resolves toTrainingDay back to the
    // same day — 0 (1970-01-01) would NOT land on 2026-08-05 and was
    // caught as a bug in this exact test during the plan's own self-review.
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-05",
      startedAt: 0,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 100,
    });
    await container.penalties.close(
      "p1",
      trainingDayStart("2026-08-05" as TrainingDay, container.tzOffsetMinutes),
    );
    const view = await getChronicleView(container);
    const day = view.heatmap.find((c) => c.day === "2026-08-05")!;
    expect(day.isPenaltyDay).toBe(true);
  });

  it("only includes main lifts in liftProgress, not accessory exercises", async () => {
    const view = await getChronicleView(container);
    const ids = view.liftProgress.map((l) => l.exerciseId);
    expect(ids).toContain("bench-press");
    // "lat-pulldown" is seeded in program.ts with isMainLift: false — a
    // real accessory exercise, not a fabricated id.
    expect(ids).not.toContain("lat-pulldown");
  });
});
