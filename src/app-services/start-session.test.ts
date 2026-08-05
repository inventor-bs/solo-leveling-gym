import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { startSession } from "./start-session";

async function testContainer() {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  return buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-05T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
}

describe("startSession", () => {
  it("creates a session and returns a plan with one entry per exercise", async () => {
    const container = await testContainer();
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plan).toHaveLength(6);
    expect(result.value.plan[0]).toMatchObject({
      exerciseId: "bench-press",
      targetSets: 4,
      repMin: 6,
      repMax: 8,
    });
  });

  it("with no history, suggests the first-time starting point", async () => {
    const container = await testContainer();
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bench = result.value.plan.find((p) => p.exerciseId === "bench-press");
    expect(bench?.overloadAction).toBe("first-time");
  });

  it("suggests progressive overload based on history", async () => {
    const container = await testContainer();
    // Log a prior completed session where every set hit the top of the range.
    const first = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "action-1",
    });
    if (!first.ok) throw new Error("setup failed");
    for (let i = 0; i < 4; i++) {
      await container.training.upsertSetLog({
        id: `set-${i}`,
        sessionId: first.value.sessionId,
        exerciseId: "bench-press",
        setIndex: i,
        reps: 8,
        weight: 80,
        completed: true,
        isPr: false,
        loggedAt: 0,
      });
    }
    await container.training.completeSession(first.value.sessionId, 1000, "C");

    const second = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "action-2",
    });
    if (!second.ok) throw new Error("second start failed");
    const bench = second.value.plan.find((p) => p.exerciseId === "bench-press");
    expect(bench?.overloadAction).toBe("increase");
    expect(bench?.suggestedWeight).toBe(82.5);
  });

  it("returns an error for an unknown program day", async () => {
    const container = await testContainer();
    const result = await startSession(container, {
      programDayId: "not-a-real-day",
      clientActionId: "action-1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("program-day-not-found");
  });

  it("REGRESSION: calling twice with the same clientActionId doesn't create two sessions", async () => {
    const container = await testContainer();
    const first = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "same-action",
    });
    const second = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "same-action",
    });
    expect(
      first.ok && second.ok && first.value.sessionId === second.value.sessionId,
    ).toBe(true);
  });
});
