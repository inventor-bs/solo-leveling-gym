import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import type { Db } from "@/infra/db/client";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { addDays, parseTrainingDay } from "@/core/shared/training-day";
import { TITLE_CATALOG } from "@/core/title/catalog";
import { awardEarnedTitles } from "./award-titles";

let db: Db;
let container: Container;

// 09:00 ICT on 2026-08-07.
const NOW_ISO = "2026-08-07T02:00:00.000Z";
const today = parseTrainingDay("2026-08-07");

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock(NOW_ISO),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
  penaltiesClosed = 0;
});

async function seedTitles() {
  await container.titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );
}

/** `days` consecutive completed Daily Quests ending today. */
async function completedQuestStreak(days: number) {
  for (let i = 0; i < days; i += 1) {
    const day = addDays(today, -i);
    await container.quests.create({
      id: `q-${day}`,
      day,
      rank: "E",
      targetPushups: 20,
      targetSitups: 20,
      targetSquats: 20,
      targetRunKm: 1,
      createdAt: 1,
    });
    await container.quests.setStatus(day, "completed", 1);
  }
}

/** `count` completed sessions starting at the given UTC instant of day. */
async function completedSessionsStartingAt(count: number, startIso: string) {
  const base = Date.parse(startIso);
  for (let i = 0; i < count; i += 1) {
    const id = `s-${startIso}-${i}`;
    await container.training.createSession({
      id,
      day: "2026-08-01",
      programDayId: "upper-a",
      startedAt: base + i,
    });
    await container.training.completeSession(id, base + i + 1000, "C");
  }
}

/**
 * Adds `count` MORE closed penalty episodes, on top of whatever this test
 * has already created. The counter matters: PenaltyRepo.create is a plain
 * insert with no onConflictDoNothing, so reusing an id inside one test
 * blows up on the primary key rather than being a no-op.
 */
let penaltiesClosed = 0;

async function closedPenalties(count: number) {
  for (let i = 0; i < count; i += 1) {
    const n = penaltiesClosed;
    penaltiesClosed += 1;
    await container.penalties.create({
      id: `p-${n}`,
      startedDay: "2026-07-01",
      startedAt: 100 + n,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 5,
    });
    await container.penalties.close(`p-${n}`, 200 + n);
  }
}

describe("awardEarnedTitles", () => {
  it("REGRESSION: does nothing at all when the roster has not been seeded", async () => {
    await completedQuestStreak(30);
    expect(await awardEarnedTitles(container)).toEqual([]);
  });

  it("earns nothing for a hunter who has done nothing", async () => {
    await seedTitles();
    expect(await awardEarnedTitles(container)).toEqual([]);
    const rows = await container.titles.all();
    expect(rows.every((t) => t.earnedAt === null)).toBe(true);
  });

  it("earns Unyielding on a 30-day streak, but not on 29", async () => {
    await seedTitles();
    await completedQuestStreak(29);
    expect(await awardEarnedTitles(container)).toEqual([]);

    await completedQuestStreak(30);
    const events = await awardEarnedTitles(container);
    expect(events).toEqual([
      { type: "TitleEarned", titleId: "unyielding", titleName: "Unyielding" },
    ]);
    expect(
      (await container.titles.byId("unyielding"))?.earnedAt,
    ).not.toBeNull();
  });

  it("REGRESSION: earning is announced once, however many times this runs", async () => {
    await seedTitles();
    await completedQuestStreak(30);
    expect(await awardEarnedTitles(container)).toHaveLength(1);
    expect(await awardEarnedTitles(container)).toEqual([]);
  });

  it("earns Monarch of Dawn after 10 sessions started before 07:00 local", async () => {
    await seedTitles();
    // 23:30 UTC is 06:30 the next day at UTC+7 — a morning session.
    await completedSessionsStartingAt(10, "2026-08-01T23:30:00.000Z");
    const events = await awardEarnedTitles(container);
    expect(events.map((e) => e.type === "TitleEarned" && e.titleId)).toContain(
      "monarch-of-dawn",
    );
  });

  it("REGRESSION: a session at 07:30 local never earns Monarch of Dawn, however early the UTC clock says it is", async () => {
    // 00:30 UTC is 07:30 at UTC+7 — past the cutoff. This is the case that
    // isolates the timezone guard in the failing direction: reading the raw
    // UTC hour gives 0, which IS before 7, so a naive implementation would
    // hand out a title for twenty sessions nobody woke up early for.
    // (An afternoon session would not prove this — its UTC hour is already
    // past the cutoff, so a broken implementation would still pass.)
    await seedTitles();
    await completedSessionsStartingAt(20, "2026-08-01T00:30:00.000Z");
    expect(await awardEarnedTitles(container)).toEqual([]);
  });

  it("earns One Who Returned after five escapes, but not after four", async () => {
    await seedTitles();
    await closedPenalties(4);
    expect(await awardEarnedTitles(container)).toEqual([]);

    await closedPenalties(1); // the fifth
    const events = await awardEarnedTitles(container);
    expect(events.map((e) => e.type === "TitleEarned" && e.titleId)).toContain(
      "one-who-returned",
    );
  });

  it("earns everything that qualifies in a single call", async () => {
    await seedTitles();
    await completedQuestStreak(30);
    await completedSessionsStartingAt(10, "2026-08-01T23:30:00.000Z");
    await closedPenalties(5);
    expect(await awardEarnedTitles(container)).toHaveLength(3);
  });

  it("REGRESSION: a broken streak never takes back an earned title", async () => {
    // Earning is one-way. Permanence lives in the stored timestamp, so a
    // later call with no streak at all must leave earnedAt exactly as it is.
    await seedTitles();
    await completedQuestStreak(30);
    await awardEarnedTitles(container);
    const earnedAt = (await container.titles.byId("unyielding"))?.earnedAt;

    await container.quests.setStatus(today, "missed", 2);
    await awardEarnedTitles(container);
    expect((await container.titles.byId("unyielding"))?.earnedAt).toBe(
      earnedAt,
    );
  });
});
