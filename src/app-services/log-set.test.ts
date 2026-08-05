import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { logSet } from "./log-set";

async function containerWithActiveSession() {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-05T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.training.createSession({
    id: "session-1",
    day: "2026-08-05",
    programDayId: "upper-a",
    startedAt: 0,
  });
  return container;
}

describe("logSet", () => {
  it("persists a set", async () => {
    const container = await containerWithActiveSession();
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(true);
    const sets = await container.training.getSetsForSession("session-1");
    expect(sets).toHaveLength(1);
    expect(sets[0]?.weight).toBe(80);
  });

  it("a first-ever set on an exercise is a PR", async () => {
    const container = await containerWithActiveSession();
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "action-1",
    });
    expect(result.ok && result.value.isPr).toBe(true);
  });

  it("a set that doesn't beat history is not a PR", async () => {
    const container = await containerWithActiveSession();
    // Prior completed session with a higher e1RM.
    await container.training.createSession({
      id: "session-0",
      day: "2026-08-04",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "old-set",
      sessionId: "session-0",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.training.completeSession("session-0", 100, "C");

    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "action-1",
    });
    expect(result.ok && result.value.isPr).toBe(false);
  });

  it("an incomplete set is never a PR", async () => {
    const container = await containerWithActiveSession();
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: false,
      clientActionId: "action-1",
    });
    expect(result.ok && result.value.isPr).toBe(false);
  });

  it("returns an error when the session doesn't exist", async () => {
    const container = await containerWithActiveSession();
    const result = await logSet(container, {
      sessionId: "not-a-real-session",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-not-found");
  });

  it("returns an error when the session is already completed", async () => {
    const container = await containerWithActiveSession();
    await container.training.completeSession("session-1", 1000, "C");
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-already-completed");
  });

  it("REGRESSION: retrying the same clientActionId doesn't log the set twice", async () => {
    const container = await containerWithActiveSession();
    await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "same-action",
    });
    await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 9,
      weight: 999,
      completed: true,
      clientActionId: "same-action",
    });
    const sets = await container.training.getSetsForSession("session-1");
    expect(sets).toHaveLength(1);
    expect(sets[0]?.weight).toBe(80); // the first call's value, not the retry's
  });
});
