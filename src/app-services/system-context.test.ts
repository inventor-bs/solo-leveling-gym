import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import { buildSystemContext } from "./system-context";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-08T02:00:00.000Z");

let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-08T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

describe("buildSystemContext", () => {
  it("returns null when no hunter is registered", async () => {
    expect(await buildSystemContext(container)).toBeNull();
  });

  it("carries the hunter's own facts, not placeholders", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    await container.hunters.update({
      level: 12,
      fatigue: 3.5,
      reasonForHunting: "To stop being the weakest",
      title: "unyielding",
    });

    const ctx = await buildSystemContext(container);
    expect(ctx).toMatchObject({
      hunterName: "Jin-Woo",
      level: 12,
      rank: "D",
      fatigue: 3.5,
      reasonForHunting: "To stop being the weakest",
      title: "unyielding",
      className: null,
    });
  });

  it("counts the sessions actually completed in the last seven days", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    for (const day of ["2026-08-06", "2026-08-07"]) {
      await container.training.createSession({
        id: `s-${day}`,
        day,
        programDayId: "upper-a",
        startedAt: 1,
      });
      await container.training.completeSession(`s-${day}`, 2, "C");
    }
    const ctx = await buildSystemContext(container);
    expect(ctx?.sessionsLast7d).toBe(2);
  });

  it("reports the narrative arc so the voice can know how far the story is", async () => {
    await container.hunters.create({
      name: "Jin-Woo",
      createdAt: NOW - 7 * DAY_MS,
    });
    const ctx = await buildSystemContext(container);
    expect(ctx?.arcStage).toBe("anomaly");
    expect(ctx?.unlockedFragments).toEqual(["first-anomaly"]);
  });

  it("splits lift trends into what is rising and what is falling", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    const ctx = await buildSystemContext(container);
    // No history at all yet: both lists are empty rather than fabricated.
    expect(ctx?.liftsUp).toEqual([]);
    expect(ctx?.liftsDown).toEqual([]);
  });

  it("starts with no message history and no penalty", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    const ctx = await buildSystemContext(container);
    expect(ctx?.lastMessages).toEqual([]);
    expect(ctx?.penaltyActive).toBe(false);
    expect(ctx?.penaltySilent).toBe(false);
    expect(ctx?.penaltyCount30d).toBe(0);
  });

  /**
   * One set at reps=1 makes weight and e1RM the same number (the Epley
   * formula collapses to identity at one rep), so the delta this fixture
   * produces is exactly `newWeight - oldWeight` — the same pattern
   * `lift-trends.test.ts` uses to drive `getLiftTrends` deterministically.
   */
  async function lifted(
    id: string,
    day: string,
    exerciseId: string,
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
      reps: 1,
      weight,
      completed: true,
      isPr: false,
      loggedAt: 1,
    });
    await container.training.completeSession(id, 2, "C");
  }

  it("sorts liftsUp/liftsDown by magnitude, caps each at 3, and drops nulls", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });

    // With `today` = 2026-08-08, the current 28-day window is 07-12..08-08
    // and the previous one is 06-14..07-11, so these two days land one in
    // each window and produce a real, non-null deltaKg.
    const OLD_DAY = "2026-07-04";
    const NEW_DAY = "2026-08-06";

    // Five rising lifts — more than TREND_NAMES (3) — to exercise the cap.
    await lifted("old-bench", OLD_DAY, "bench-press", 90);
    await lifted("new-bench", NEW_DAY, "bench-press", 100); // +10
    await lifted("old-row", OLD_DAY, "barbell-row", 60);
    await lifted("new-row", NEW_DAY, "barbell-row", 65); // +5
    await lifted("old-curl", OLD_DAY, "db-curl", 40);
    await lifted("new-curl", NEW_DAY, "db-curl", 43); // +3
    await lifted("old-triceps", OLD_DAY, "triceps-pushdown", 30);
    await lifted("new-triceps", NEW_DAY, "triceps-pushdown", 32); // +2
    await lifted("old-rdl", OLD_DAY, "romanian-deadlift", 100);
    await lifted("new-rdl", NEW_DAY, "romanian-deadlift", 101); // +1

    // Two falling lifts.
    await lifted("old-ohp", OLD_DAY, "overhead-press", 100);
    await lifted("new-ohp", NEW_DAY, "overhead-press", 80); // -20
    await lifted("old-squat", OLD_DAY, "back-squat", 150);
    await lifted("new-squat", NEW_DAY, "back-squat", 140); // -10

    // Only one window has history: deltaKg is null, so this must appear in
    // neither list rather than being coerced into "flat" or "unchanged".
    await lifted("only-lat", NEW_DAY, "lat-pulldown", 50);

    const ctx = await buildSystemContext(container);

    // Largest gain first, capped at 3 even though 5 lifts rose.
    expect(ctx?.liftsUp).toHaveLength(3);
    expect(ctx?.liftsUp.map((l) => l.name)).toEqual([
      "Bench Press",
      "Barbell Row",
      "DB Curl",
    ]);
    expect(ctx?.liftsUp.map((l) => l.deltaKg)).toEqual([10, 5, 3]);

    // Steepest fall first.
    expect(ctx?.liftsDown.map((l) => l.name)).toEqual([
      "Overhead Press",
      "Back Squat",
    ]);
    expect(ctx?.liftsDown.map((l) => l.deltaKg)).toEqual([-20, -10]);

    const namedAnywhere = [
      ...(ctx?.liftsUp ?? []),
      ...(ctx?.liftsDown ?? []),
    ].map((l) => l.name);
    expect(namedAnywhere).not.toContain("Lat Pulldown");
  });
});
