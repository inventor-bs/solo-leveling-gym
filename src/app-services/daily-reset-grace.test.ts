import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { runGraceReset } from "./daily-reset-grace";

async function containerAt(day: string): Promise<Container> {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    // 04:00 local on `day` is 21:00 UTC the evening before.
    clock: fixedClock(`${day}T21:00:00Z`),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  return container;
}

async function graceDayWithActiveQuest(container: Container, day: string) {
  await container.quests.create({
    id: `q-${day}`,
    day,
    rank: "E",
    targetPushups: 20,
    targetSitups: 20,
    targetSquats: 20,
    targetRunKm: 1,
    createdAt: 0,
  });
  await container.mitigation.grantGrace(day, 1);
}

describe("runGraceReset", () => {
  it("judges a still-unfinished grace day as missed and opens the penalty", async () => {
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-08");

    const summary = await runGraceReset(container);
    expect(summary.judged).toEqual([{ day: "2026-08-08", status: "missed" }]);
    expect(summary.penaltyOpened).toBe(true);
    expect((await container.quests.byDay("2026-08-08"))?.status).toBe("missed");
    expect(await container.penalties.active()).not.toBeNull();
  });

  it("closes a grace day the hunter finished inside the extra hours", async () => {
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-08");
    await container.quests.addProgress("2026-08-08", {
      pushups: 20,
      situps: 20,
      squats: 20,
    });
    await container.training.createRun({
      id: "r1",
      day: "2026-08-08",
      distanceKm: 2,
      durationSec: 900,
      loggedAt: 1,
    });

    const summary = await runGraceReset(container);
    expect(summary.judged).toEqual([
      { day: "2026-08-08", status: "completed" },
    ]);
    expect(summary.penaltyOpened).toBe(false);
    expect(await container.penalties.active()).toBeNull();
  });

  it("leaves today's grace day alone — its window has not closed yet", async () => {
    // containerAt's clock always lands one calendar day AFTER the string it
    // is given (04:00 local on day+1 — see its own comment), so "today" as
    // runGraceReset computes it is "2026-08-09" here, not "2026-08-08".
    // Naming the grace day "2026-08-09" is what actually makes it today's
    // still-open day; passing "2026-08-09" to containerAt too (as every
    // other test in this file does with its own day) would instead make
    // today "2026-08-10" and this grace day yesterday's, already-closed one
    // — the opposite of what this test means to check.
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-09");
    const summary = await runGraceReset(container);
    expect(summary.judged).toEqual([]);
  });

  it("skips a grace day whose quest was already judged", async () => {
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-08");
    await container.quests.setStatus("2026-08-08", "completed", 1);
    const summary = await runGraceReset(container);
    expect(summary.judged).toEqual([]);
  });

  it("is idempotent — a second run finds nothing left to judge", async () => {
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-08");
    await runGraceReset(container);
    const second = await runGraceReset(container);
    expect(second.judged).toEqual([]);
    expect(second.penaltyOpened).toBe(false);
  });

  it("judges nothing at all while a penalty episode is already open", async () => {
    // No punishment stacks on a punishment — the same rule the 00:00 reset
    // has enforced since the Penalty Zone shipped.
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-08");
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-05",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 10,
    });
    const summary = await runGraceReset(container);
    expect(summary.judged).toEqual([]);
  });

  it("opens at most one penalty even with two unjudged grace days", async () => {
    const container = await containerAt("2026-08-08");
    await graceDayWithActiveQuest(container, "2026-08-06");
    await graceDayWithActiveQuest(container, "2026-08-07");
    const summary = await runGraceReset(container);
    expect(summary.penaltyOpened).toBe(true);
    expect(await container.penalties.countAll()).toBe(1);
  });
});
