import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { completeSession } from "./complete-session";

async function containerWithLoggedSession() {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-05T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
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
  return container;
}

describe("completeSession", () => {
  it("marks the session ended with a rank", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const session = await container.training.getSession("session-1");
    expect(session?.endedAt).not.toBeNull();
    expect(session?.rank).toBeTruthy();
  });

  it("awards gold and EXP matching the computed rank", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldAwarded).toBeGreaterThan(0);
    expect(result.value.expAwarded).toBeGreaterThan(0);

    const hunter = await container.hunters.get();
    expect(hunter?.gold).toBe(result.value.goldAwarded);
  });

  it("levels up the hunter when EXP crosses the threshold", async () => {
    const container = await containerWithLoggedSession();
    // With no history, this session's rank defaults to C (dungeonRankFor
    // with avgVolume=0), which awards 350 EXP — comfortably over the
    // level-1 threshold of 100.
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.levelsGained).toBeGreaterThan(0);

    const hunter = await container.hunters.get();
    expect(hunter?.level).toBeGreaterThan(1);
  });

  it("updates hunter fatigue", async () => {
    const container = await containerWithLoggedSession();
    const before = await container.hunters.get();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const after = await container.hunters.get();
    expect(after?.fatigue ?? 0).toBeGreaterThan(before?.fatigue ?? 0);
  });

  it("returns an error for an already-completed session", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-already-completed");
  });

  it("returns an error for an unknown session", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "not-a-real-session",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-not-found");
  });

  it("REGRESSION: retrying the same clientActionId doesn't award gold twice", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "same-action",
    });
    const hunterAfterFirst = await container.hunters.get();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "same-action",
    });
    const hunterAfterSecond = await container.hunters.get();
    expect(hunterAfterSecond?.gold).toBe(hunterAfterFirst?.gold);
  });
});
