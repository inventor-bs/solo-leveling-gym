import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import type { TrainingDay } from "@/core/shared/training-day";
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

async function containerWithActiveSessionAndShadows() {
  const container = await containerWithActiveSession();
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 0 : null,
    })),
  );
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

describe("logSet — shadow extraction", () => {
  it("extracts the matching shadow on that muscle group's first PR", async () => {
    const container = await containerWithActiveSessionAndShadows();
    const before = await container.shadows.byId("tank");
    expect(before?.extractedAt).toBeNull();

    await logSet(container, {
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      clientActionId: "a",
    });

    const after = await container.shadows.byId("tank");
    expect(after?.extractedAt).not.toBeNull();
  });

  it("REGRESSION: a non-PR set never extracts a shadow", async () => {
    const container = await containerWithActiveSessionAndShadows();
    // Seed a prior completed session with a higher e1RM on barbell-row, so
    // the set logged below is provably NOT a PR (isPr will be false) while
    // Tank is still unextracted. This isolates the isPr gate: if it were
    // ever removed, extraction would still fire on this "first encounter"
    // for the shadow and the assertions below would catch it.
    await container.training.createSession({
      id: "session-0",
      day: "2026-08-04",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "old-set",
      sessionId: "session-0",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.training.completeSession("session-0", 100, "C");

    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isPr).toBe(false);
      expect(result.value.events.some((e) => e.type === "ShadowArisen")).toBe(
        false,
      );
    }

    const tank = await container.shadows.byId("tank");
    expect(tank?.extractedAt).toBeNull();
  });

  it("emits a ShadowArisen event carrying the shadow's name", async () => {
    const container = await containerWithActiveSessionAndShadows();
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const arisen = result.value.events.find((e) => e.type === "ShadowArisen");
      expect(arisen).toMatchObject({ shadowId: "tank", shadowName: "Tank" });
    }
  });

  it("does nothing to an already-extracted shadow on a later PR", async () => {
    // bench-press is chest — Igris, seeded already extracted above.
    const container = await containerWithActiveSessionAndShadows();
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 5,
      weight: 100,
      completed: true,
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "ShadowArisen")).toBe(
        false,
      );
    }
  });

  it("REGRESSION: does nothing when the shadow roster hasn't been seeded", async () => {
    const container = await containerWithActiveSession(); // no shadows.seed call
    const result = await logSet(container, {
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      clientActionId: "a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "ShadowArisen")).toBe(
        false,
      );
    }
  });
});

describe("logSet — event persistence", () => {
  it("persists the logged event(s) to the event log", async () => {
    const container = await containerWithActiveSession();
    await logSet(container, {
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      clientActionId: "a",
    });
    const rows = await container.events.between(
      "2026-08-05" as TrainingDay,
      "2026-08-05" as TrainingDay,
    );
    expect(rows.some((r) => r.type === "SetLogged")).toBe(true);
  });
});
