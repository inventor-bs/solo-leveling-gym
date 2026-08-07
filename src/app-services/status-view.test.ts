import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import type { Db } from "@/infra/db/client";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { TITLE_CATALOG } from "@/core/title/catalog";
import { getStatusView } from "./status-view";

let db: Db;
let container: Container;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-07T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

async function onboarded() {
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
  await container.titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 1 : null,
    })),
  );
}

describe("getStatusView", () => {
  it("is null before a hunter has been registered", async () => {
    expect(await getStatusView(container)).toBeNull();
  });

  it("reports the hunter's identity, progression and Army Rank", async () => {
    await onboarded();
    const view = await getStatusView(container);
    expect(view?.name).toBe("Jin-Woo");
    expect(view?.level).toBe(1);
    expect(view?.rank).toBe("E");
    expect(view?.expToNext).toBeGreaterThan(0);
    expect(view?.armyRank).toBe("Normal"); // only Igris extracted, at Normal
  });

  it("REGRESSION: class name is passed through as null until Job Change exists", async () => {
    // Nothing in this app writes hunter.class_name yet. Inventing a class
    // would be inventing a number the training logs cannot back.
    await onboarded();
    expect((await getStatusView(container))?.className).toBeNull();
  });

  it("lists every title with its condition and buff, earned or not", async () => {
    await onboarded();
    const view = await getStatusView(container);
    expect(view?.titles).toHaveLength(3);
    const unyielding = view?.titles.find((t) => t.id === "unyielding");
    expect(unyielding?.earned).toBe(false);
    expect(unyielding?.equipped).toBe(false);
    expect(unyielding?.condition.length).toBeGreaterThan(0);
    expect(unyielding?.buff.length).toBeGreaterThan(0);
  });

  it("marks the earned and equipped title", async () => {
    await onboarded();
    await container.titles.earn("unyielding", 5);
    await container.hunters.update({ title: "unyielding" });

    const view = await getStatusView(container);
    expect(view?.equippedTitleId).toBe("unyielding");
    const unyielding = view?.titles.find((t) => t.id === "unyielding");
    expect(unyielding?.earned).toBe(true);
    expect(unyielding?.equipped).toBe(true);
  });

  it("REGRESSION: leaves the measured stats untouched and applies the penalty only to the shown copy", async () => {
    // The penalty is an adjustment at the read layer. If it ever overwrote
    // the measured value, one bad day would permanently rewrite the record.
    await onboarded();
    await container.training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 10,
      durationSec: 3000,
      loggedAt: 1,
    });
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-07",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });

    const view = await getStatusView(container);
    expect(view?.penaltyActive).toBe(true);
    expect(view?.measuredStats.agility).toBeGreaterThan(0);
    expect(view?.stats.agility).toBeLessThan(view!.measuredStats.agility);

    const hunter = await container.hunters.get();
    expect(hunter?.agility).toBe(0); // nothing was written back
  });

  it("shows the measured stats unmodified when no penalty is active", async () => {
    await onboarded();
    await container.training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 10,
      durationSec: 3000,
      loggedAt: 1,
    });
    const view = await getStatusView(container);
    expect(view?.penaltyActive).toBe(false);
    expect(view?.stats).toEqual(view?.measuredStats);
  });

  it("includes the lift trend rows", async () => {
    await onboarded();
    await container.training.createSession({
      id: "s1",
      day: "2026-08-06",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await container.training.upsertSetLog({
      id: "s1-set",
      sessionId: "s1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 1,
      weight: 100,
      completed: true,
      isPr: true,
      loggedAt: 1,
    });
    await container.training.completeSession("s1", 2, "C");

    const view = await getStatusView(container);
    expect(view?.lifts.map((l) => l.exerciseId)).toEqual(["bench-press"]);
    expect(view?.lifts[0]?.bestE1rm).toBe(100);
  });

  it("reports fatigue and its level", async () => {
    await onboarded();
    await container.hunters.update({ fatigue: 90 });
    const view = await getStatusView(container);
    expect(view?.fatigue).toBe(90);
    expect(view?.fatigueLevel).toBe("critical");
  });
});
