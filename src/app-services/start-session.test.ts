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

describe("startSession — dungeon break", () => {
  /** Container whose clock reads 09:00 ICT on the given calendar day. */
  async function containerOn(iso: string) {
    const db = await makeTestDb();
    const c = buildContainer({
      db,
      clock: fixedClock(iso),
      tzOffsetMinutes: 420,
    });
    await seedProgram(db);
    return c;
  }

  it("leaves the plan alone when the previous scheduled day was trained", async () => {
    // Trained Monday 2026-08-03, now Wednesday 2026-08-05: nothing skipped.
    const c = await containerOn("2026-08-05T02:00:00.000Z");
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await c.training.createSession({
      id: "s1",
      day: "2026-08-03",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await c.training.completeSession("s1", 2, "C");

    const result = await startSession(c, {
      programDayId: "lower-a",
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dungeonBreak.missedSessions).toBe(0);
      expect(result.value.dungeonBreak.multiplier).toBe(1);
      // Upper A's first slot is 4 sets in the seeded program.
      expect(result.value.plan[0]?.targetSets).toBe(4);
    }
  });

  it("carries one skipped session forward at +20 percent", async () => {
    // Trained Monday 2026-08-03, skipped Wednesday, now Friday 2026-08-07.
    const c = await containerOn("2026-08-07T02:00:00.000Z");
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await c.training.createSession({
      id: "s1",
      day: "2026-08-03",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await c.training.completeSession("s1", 2, "C");

    const result = await startSession(c, {
      programDayId: "upper-b",
      clientActionId: "b",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dungeonBreak.missedSessions).toBe(1);
      expect(result.value.dungeonBreak.multiplier).toBe(1.2);
      expect(result.value.plan[0]?.targetSets).toBe(5); // 4 * 1.2 = 4.8 -> 5
    }
  });

  it("REGRESSION: a run logged on an off-day does not forgive a skipped lifting day", async () => {
    // Trained Monday 2026-08-03, skipped Wednesday, ran Thursday (an
    // off-day for lifting), now lifting Friday 2026-08-07. The Thursday
    // run must not erase the missed Wednesday lifting session.
    const c = await containerOn("2026-08-07T02:00:00.000Z");
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await c.training.createSession({
      id: "s1",
      day: "2026-08-03",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await c.training.completeSession("s1", 2, "C");
    await c.training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 5,
      durationSec: 1500,
      loggedAt: 1,
    });

    const result = await startSession(c, {
      programDayId: "upper-b",
      clientActionId: "d",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dungeonBreak.missedSessions).toBe(1);
      expect(result.value.dungeonBreak.multiplier).toBe(1.2);
    }
  });

  it("REGRESSION: three skipped sessions still cap the carry at +40 percent", async () => {
    // Trained Monday 2026-08-03, then nothing until Saturday 2026-08-15:
    // Wed 5th, Fri 7th, Sat 8th, Mon 10th, Wed 12th, Fri 14th all missed.
    // Without the cap this would compound into a session nobody can finish,
    // which turns a nudge into a reason to quit.
    const c = await containerOn("2026-08-15T02:00:00.000Z");
    await c.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await c.training.createSession({
      id: "s1",
      day: "2026-08-03",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await c.training.completeSession("s1", 2, "C");

    const result = await startSession(c, {
      programDayId: "lower-b",
      clientActionId: "c",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dungeonBreak.missedSessions).toBeGreaterThan(2);
      expect(result.value.dungeonBreak.multiplier).toBe(1.4);
    }
  });
});

describe("startSession — dungeon types", () => {
  it("plans every exercise as standard when nothing is overridden", async () => {
    const container = await testContainer();
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    for (const exercise of result.value.plan) {
      expect(exercise.dungeonType).toBe("standard");
      expect(exercise.timeLimitSec).toBeNull();
    }
  });

  it("honours an override once its dungeon type has been unlocked", async () => {
    const container = await testContainer();
    await container.store.unlock("dungeon-type:amrap", 0);
    // suggestNextLoad only reports the "amrap" action once there is a
    // completed set to carry the weight forward from — with no history at
    // all it always reports "first-time" regardless of dungeonType, same
    // as the pre-existing "with no history" test above. Seed one prior
    // completed session so the override actually has something to shape.
    const first = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a0",
    });
    if (!first.ok) throw new Error("setup failed");
    await container.training.upsertSetLog({
      id: "set-0",
      sessionId: first.value.sessionId,
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 8,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.training.completeSession(first.value.sessionId, 1000, "C");

    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a1",
      dungeonTypeOverrides: { "bench-press": "amrap" },
    });
    if (!result.ok) return;
    const bench = result.value.plan.find((p) => p.exerciseId === "bench-press");
    expect(bench?.dungeonType).toBe("amrap");
    expect(bench?.overloadAction).toBe("amrap");
    expect(bench?.timeLimitSec).toBe(720);
  });

  it("attaches no time limit to EMOM or Drop-set", async () => {
    const container = await testContainer();
    await container.store.unlock("dungeon-type:dropset", 0);
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a1",
      dungeonTypeOverrides: { "bench-press": "dropset" },
    });
    if (!result.ok) return;
    const bench = result.value.plan.find((p) => p.exerciseId === "bench-press");
    expect(bench?.dungeonType).toBe("dropset");
    expect(bench?.timeLimitSec).toBeNull();
  });

  it("ignores an override for a type that has not been bought", async () => {
    // Falling back to standard rather than erroring: an unlock that is
    // missing must never be able to block a session from opening at all.
    const container = await testContainer();
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a1",
      dungeonTypeOverrides: { "bench-press": "amrap" },
    });
    if (!result.ok) return;
    const bench = result.value.plan.find((p) => p.exerciseId === "bench-press");
    expect(bench?.dungeonType).toBe("standard");
  });

  it("leaves every other exercise standard when one is overridden", async () => {
    const container = await testContainer();
    await container.store.unlock("dungeon-type:emom", 0);
    const result = await startSession(container, {
      programDayId: "upper-a",
      clientActionId: "a1",
      dungeonTypeOverrides: { "bench-press": "emom" },
    });
    if (!result.ok) return;
    const others = result.value.plan.filter(
      (p) => p.exerciseId !== "bench-press",
    );
    expect(others.every((p) => p.dungeonType === "standard")).toBe(true);
  });
});
