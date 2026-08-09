import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { seedProgram } from "@/infra/db/seed/program";
import type { SystemVoicePort } from "@/ports/system-voice.port";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { runDailyReset } from "./daily-reset";

let container: Container;
const yesterday = parseTrainingDay("2026-08-05");

beforeEach(async () => {
  const db = await makeTestDb();
  // 2026-08-06T00:05 ICT — just after the reset boundary.
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-05T17:05:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

describe("runDailyReset", () => {
  it("issues today's quest", async () => {
    const summary = await runDailyReset(container);
    expect(summary.today).toBe("2026-08-06");
    expect(summary.issuedToday).toBe(true);
    expect(await container.quests.byDay("2026-08-06")).not.toBeNull();
  });

  it("reports 'none' when there was no quest yesterday at all", async () => {
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("none");
  });

  it("marks an untouched quest from yesterday as missed", async () => {
    await ensureDailyQuest(container, yesterday);
    const summary = await runDailyReset(container);

    expect(summary.yesterdayStatus).toBe("missed");
    expect(summary.events.some((e) => e.type === "DailyQuestMissed")).toBe(
      true,
    );
    const row = await container.quests.byDay(yesterday);
    expect(row?.status).toBe("missed");
  });

  it("marks yesterday completed when its requirements were actually met", async () => {
    await ensureDailyQuest(container, yesterday);
    await container.quests.addProgress(yesterday, {
      pushups: 20,
      situps: 20,
      squats: 20,
    });
    await container.training.createRun({
      id: "r1",
      day: yesterday,
      distanceKm: 1,
      durationSec: 400,
      loggedAt: 1,
    });

    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("completed");
    expect(await container.quests.byDay(yesterday)).toMatchObject({
      status: "completed",
    });
  });

  it("REGRESSION: running twice does not re-issue today or re-judge yesterday", async () => {
    await ensureDailyQuest(container, yesterday);
    const first = await runDailyReset(container);
    const second = await runDailyReset(container);

    expect(first.issuedToday).toBe(true);
    expect(second.issuedToday).toBe(false);
    // First run judged yesterday as missed and opened a penalty; second run
    // finds the penalty already open and skips judging entirely rather than
    // re-reporting "missed".
    expect(second.yesterdayStatus).toBe("skipped-penalty-active");
    expect(second.events.some((e) => e.type === "DailyQuestMissed")).toBe(
      false,
    );
  });

  it("leaves a quest already marked completed alone", async () => {
    await ensureDailyQuest(container, yesterday);
    await container.quests.setStatus(yesterday, "completed", 1);
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("completed");
    expect(summary.events.some((e) => e.type === "DailyQuestMissed")).toBe(
      false,
    );
  });
});

describe("runDailyReset — penalty interaction", () => {
  it("opens a penalty when yesterday's quest was missed", async () => {
    await ensureDailyQuest(container, yesterday);
    await container.hunters.update({ exp: 300 });

    const summary = await runDailyReset(container);

    expect(summary.penaltyOpened).toBe(true);
    expect(await container.penalties.active()).not.toBeNull();
    expect((await container.hunters.get())?.exp).toBe(270);
  });

  it("opens no penalty when yesterday was cleared", async () => {
    await ensureDailyQuest(container, yesterday);
    await container.quests.setStatus(yesterday, "completed", 1);

    const summary = await runDailyReset(container);
    expect(summary.penaltyOpened).toBe(false);
    expect(await container.penalties.active()).toBeNull();
  });

  it("REGRESSION: does not judge the quest at all while a penalty is active", async () => {
    // Five stuck days must leave exactly one Survival Quest owed, not five
    // penalties and five EXP deductions.
    await ensureDailyQuest(container, yesterday);
    await container.hunters.update({ exp: 1000 });
    await runDailyReset(container); // opens the penalty, exp -> 900

    const second = await runDailyReset(container);
    expect(second.yesterdayStatus).toBe("skipped-penalty-active");
    expect(second.penaltyOpened).toBe(false);
    expect((await container.hunters.get())?.exp).toBe(900);
    expect(await container.penalties.countAll()).toBe(1);
  });

  it("still issues today's quest while a penalty is active", async () => {
    await ensureDailyQuest(container, yesterday);
    await runDailyReset(container);
    const summary = await runDailyReset(container);
    expect(await container.quests.byDay(summary.today)).not.toBeNull();
  });

  it("persists yesterday's judgment events under yesterday's day, not today's", async () => {
    await ensureDailyQuest(container, yesterday);
    await container.hunters.update({ exp: 300 });

    const summary = await runDailyReset(container);
    expect(summary.penaltyOpened).toBe(true);

    const yesterdayRows = await container.events.between(yesterday, yesterday);
    // Exact counts, not .some(): enterPenalty persists PenaltyStarted itself
    // (see enter-penalty.ts), so daily-reset must not persist it a second
    // time when it folds enterPenalty's events into its own return value.
    expect(
      yesterdayRows.filter((r) => r.type === "DailyQuestMissed").length,
    ).toBe(1);
    expect(
      yesterdayRows.filter((r) => r.type === "PenaltyStarted").length,
    ).toBe(1);
    expect(yesterdayRows.length).toBe(2);

    const today = parseTrainingDay(summary.today);
    const todayRows = await container.events.between(today, today);
    // Not an exact-length check: this hunter's createdAt is old enough that
    // ensureNarrativeUnlocks legitimately unlocks a fragment under today on
    // this same call. What this test actually guards is that yesterday's
    // judgment events specifically do not leak into today's log.
    expect(todayRows.some((r) => r.type === "DailyQuestMissed")).toBe(false);
    expect(todayRows.some((r) => r.type === "PenaltyStarted")).toBe(false);
  });
});

describe("narrative milestones", () => {
  it("advances the arc from the daily reset", async () => {
    const db = await makeTestDb();
    const c = buildContainer({
      db,
      clock: fixedClock("2026-08-05T17:05:00.000Z"),
      tzOffsetMinutes: 420,
    });
    // 2026-07-30 ICT: seven days before the reset's "today" of 2026-08-06.
    await c.hunters.create({
      name: "Jin-Woo",
      createdAt: Date.parse("2026-07-30T02:00:00.000Z"),
    });

    const summary = await runDailyReset(c);
    expect(summary.fragmentsUnlocked).toBe(1);
    expect(await c.narrative.unlockedIds()).toEqual(["first-anomaly"]);
  });

  it("REGRESSION: still advances the arc while a penalty episode is open", async () => {
    const db = await makeTestDb();
    const c = buildContainer({
      db,
      clock: fixedClock("2026-08-05T17:05:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await c.hunters.create({
      name: "Jin-Woo",
      createdAt: Date.parse("2026-07-30T02:00:00.000Z"),
    });
    await c.penalties.create({
      id: "p1",
      startedDay: "2026-08-04",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });

    const summary = await runDailyReset(c);
    expect(summary.yesterdayStatus).toBe("skipped-penalty-active");
    expect(summary.fragmentsUnlocked).toBe(1);
  });
});

describe("the composed daily reset", () => {
  it("advances the narrative arc, reveals the Seventh Day hidden quest, and generates the voice pool together, in one run", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const stubVoice: SystemVoicePort = {
      generate: async () => ({
        body: "Hunter. Continue.",
        severity: "info",
        title: null,
      }),
    };
    const c = buildContainer({
      db,
      clock: fixedClock("2026-08-05T17:05:00.000Z"), // "today" = 2026-08-06 ICT
      tzOffsetMinutes: 420,
      voice: stubVoice,
    });
    await c.hunters.create({
      name: "Jin-Woo",
      createdAt: Date.parse("2026-07-30T02:00:00.000Z"), // 7 days before "today"
    });
    await c.training.createSession({
      id: "s1",
      day: "2026-07-31",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await c.training.completeSession("s1", 2, "C");

    const summary = await runDailyReset(c);

    expect(summary.fragmentsUnlocked).toBe(1);
    expect(summary.hiddenQuestsRevealed).toBe(1);
    expect(summary.voiceMessagesGenerated).toBe(2);

    expect(await c.narrative.unlockedIds()).toEqual(["first-anomaly"]);
    expect(await c.hiddenQuests.byId("the-seventh-day")).not.toBeNull();
    expect(
      await c.systemMessages.byDayAndKind("2026-08-06", "briefing"),
    ).not.toBeNull();
    expect(
      await c.systemMessages.byDayAndKind("2026-08-06", "quest"),
    ).not.toBeNull();

    const events = await c.events.between(
      "2026-08-06" as never,
      "2026-08-06" as never,
    );
    expect(events.map((e) => e.type)).toContain("NarrativeFragmentUnlocked");
    expect(events.map((e) => e.type)).toContain("HiddenQuestRevealed");

    // A second run on the same day changes nothing further.
    const second = await runDailyReset(c);
    expect(second.fragmentsUnlocked).toBe(0);
    expect(second.hiddenQuestsRevealed).toBe(0);
    expect(second.voiceMessagesGenerated).toBe(0);
  });
});

async function containerAtDay(day: string) {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock(`${day}T01:00:00Z`),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  return container;
}

describe("runDailyReset — stale challenges", () => {
  it("expires a challenge bought before today and reports it", async () => {
    const container = await containerAtDay("2026-08-09");
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now() - 86_400_000,
      floor: null,
    });
    const summary = await runDailyReset(container);
    expect(summary.challengesExpired).toBe(1);
    expect(await container.store.pendingChallenge()).toBeNull();
    expect(summary.events.map((e) => e.type)).toContain("RedGateFailed");
  });

  it("leaves a challenge bought today alone — the session is still to come", async () => {
    const container = await containerAtDay("2026-08-09");
    await container.store.setPendingChallenge({
      type: "boss-raid",
      purchasedAt: container.clock.now(),
      floor: null,
    });
    const summary = await runDailyReset(container);
    expect(summary.challengesExpired).toBe(0);
    expect(await container.store.pendingChallenge()).not.toBeNull();
  });

  it("expires a stale challenge even while a penalty episode is open", async () => {
    // The early return for an active penalty must not swallow economy
    // upkeep: the gold was already spent and the row has to be cleared.
    const container = await containerAtDay("2026-08-09");
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-07",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 10,
    });
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now() - 86_400_000,
      floor: null,
    });
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("skipped-penalty-active");
    expect(summary.challengesExpired).toBe(1);
  });

  it("persists the expiry event exactly once", async () => {
    const container = await containerAtDay("2026-08-09");
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now() - 86_400_000,
      floor: null,
    });
    await runDailyReset(container);
    const rows = await container.events.between(
      "2026-08-08" as never,
      "2026-08-09" as never,
    );
    expect(rows.filter((r) => r.type === "RedGateFailed")).toHaveLength(1);
  });
});

describe("runDailyReset — Perfect Week", () => {
  /**
   * The seeded program lifts on ISO weekdays 1, 3, 5 and 6. For the week of
   * Monday 2026-08-03 that is the 3rd, 5th, 7th and 8th.
   */
  const SCHEDULED = ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-08"];
  const WEEK = [
    "2026-08-03",
    "2026-08-04",
    "2026-08-05",
    "2026-08-06",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
  ];

  /** `trainOn` defaults to every scheduled day; pass a subset to skip one. */
  async function perfectPreviousWeek(
    container: Container,
    trainOn: string[] = SCHEDULED,
  ) {
    for (const [i, day] of trainOn.entries()) {
      await container.training.createSession({
        id: `s-${i}`,
        day,
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.completeSession(`s-${i}`, i + 1, "C");
    }
    for (const [i, day] of WEEK.entries()) {
      await container.quests.create({
        id: `q-${i}`,
        day,
        rank: "E",
        targetPushups: 20,
        targetSitups: 20,
        targetSquats: 20,
        targetRunKm: 1,
        createdAt: i,
      });
      await container.quests.setStatus(day, "completed", i);
    }
  }

  it("pays 500 gold on the Monday after a week that met all three conditions", async () => {
    // 2026-08-10 is a Monday, so the week judged is 08-03 to 08-09.
    const container = await containerAtDay("2026-08-10");
    await perfectPreviousWeek(container);
    const before = (await container.hunters.get())?.gold ?? 0;

    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(true);
    expect((await container.hunters.get())?.gold).toBe(before + 500);
    expect(summary.events).toContainEqual({
      type: "PerfectWeek",
      weekStart: "2026-08-03",
      goldAwarded: 500,
    });
  });

  it("does nothing on a day that is not a Monday", async () => {
    const container = await containerAtDay("2026-08-11");
    await perfectPreviousWeek(container);
    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(false);
  });

  it("pays only once however many times the cron runs that Monday", async () => {
    const container = await containerAtDay("2026-08-10");
    await perfectPreviousWeek(container);
    const before = (await container.hunters.get())?.gold ?? 0;
    await runDailyReset(container);
    const second = await runDailyReset(container);
    expect(second.perfectWeekAwarded).toBe(false);
    expect((await container.hunters.get())?.gold).toBe(before + 500);
  });

  it("pays nothing when a scheduled day went untrained", async () => {
    const container = await containerAtDay("2026-08-10");
    // Every quest cleared, no penalty — but the Saturday session never
    // happened, which is enough on its own to lose the week.
    await perfectPreviousWeek(container, SCHEDULED.slice(0, 3));
    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(false);
  });

  it("pays nothing when one quest in the week went unfinished", async () => {
    const container = await containerAtDay("2026-08-10");
    await perfectPreviousWeek(container);
    await container.quests.setStatus("2026-08-06", "missed", 1);
    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(false);
  });

  it("pays nothing when a penalty opened inside the week", async () => {
    const container = await containerAtDay("2026-08-10");
    await perfectPreviousWeek(container);
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-06",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 10,
    });
    await container.penalties.close("p1", 2);
    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(false);
  });

  it("pays nothing for a week with nothing in it at all", async () => {
    const container = await containerAtDay("2026-08-10");
    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(false);
  });
});
