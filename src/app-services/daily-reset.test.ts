import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { FIVE_DAY_STREAK_GOLD } from "@/core/quest/hidden-quest";
import { seedProgram } from "@/infra/db/seed/program";
import type { SystemVoicePort } from "@/ports/system-voice.port";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { runDailyReset } from "./daily-reset";
import { runGraceReset } from "./daily-reset-grace";

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
    // A full seven-day quest-completion streak also earns Unbroken, on top
    // of the 500 for Perfect Week itself.
    expect((await container.hunters.get())?.gold).toBe(
      before + 500 + FIVE_DAY_STREAK_GOLD,
    );
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
    expect((await container.hunters.get())?.gold).toBe(
      before + 500 + FIVE_DAY_STREAK_GOLD,
    );
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

describe("runDailyReset — wager resolution", () => {
  async function weekOfTraining(
    container: Container,
    opts: { dungeons: number; runs: number; quests: number },
  ) {
    const days = [
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ];
    for (let i = 0; i < opts.dungeons; i += 1) {
      await container.training.createSession({
        id: `s-${i}`,
        day: days[i]!,
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.completeSession(`s-${i}`, i + 1, "C");
    }
    for (let i = 0; i < opts.runs; i += 1) {
      await container.training.createRun({
        id: `r-${i}`,
        day: days[i]!,
        distanceKm: 3,
        durationSec: 1_200,
        loggedAt: i,
      });
    }
    for (let i = 0; i < opts.quests; i += 1) {
      await container.quests.create({
        id: `q-${i}`,
        day: days[i]!,
        rank: "E",
        targetPushups: 20,
        targetSitups: 20,
        targetSquats: 20,
        targetRunKm: 1,
        createdAt: i,
      });
      await container.quests.setStatus(days[i]!, "completed", i);
    }
  }

  it("credits three times the stake for a week that met the contract", async () => {
    const container = await containerAtDay("2026-08-10");
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    await weekOfTraining(container, { dungeons: 4, runs: 2, quests: 7 });
    const before = (await container.hunters.get())?.gold ?? 0;

    const summary = await runDailyReset(container);
    expect(summary.wagersResolved).toBe(1);
    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe("won");
    // The wager's own seven completed quests also earn Unbroken alongside
    // the 3x stake payout.
    expect((await container.hunters.get())?.gold).toBe(
      before + 600 + FIVE_DAY_STREAK_GOLD,
    );
    expect(summary.events).toContainEqual({
      type: "WagerWon",
      weekStart: "2026-08-03",
      stakeGold: 200,
      payoutGold: 600,
    });
  });

  it("loses the week when any single target fell short, costing nothing further", async () => {
    const container = await containerAtDay("2026-08-10");
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    await weekOfTraining(container, { dungeons: 4, runs: 1, quests: 7 });
    const before = (await container.hunters.get())?.gold ?? 0;

    const summary = await runDailyReset(container);
    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe("lost");
    // The wager itself pays nothing, but the fixture's seven completed
    // quests are a real streak — Unbroken still fires on top of the loss.
    expect((await container.hunters.get())?.gold).toBe(
      before + FIVE_DAY_STREAK_GOLD,
    );
    expect(summary.events).toContainEqual({
      type: "WagerLost",
      weekStart: "2026-08-03",
      stakeGold: 200,
    });
  });

  it("leaves the current week's wager alone", async () => {
    const container = await containerAtDay("2026-08-10");
    await container.wagers.place({
      weekStart: "2026-08-10",
      stakeGold: 200,
      placedAt: 1,
    });
    const summary = await runDailyReset(container);
    expect(summary.wagersResolved).toBe(0);
    expect((await container.wagers.byWeek("2026-08-10"))?.status).toBe(
      "active",
    );
  });

  it("pays a won wager only once, however many times the cron runs", async () => {
    const container = await containerAtDay("2026-08-10");
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    await weekOfTraining(container, { dungeons: 4, runs: 2, quests: 7 });
    const before = (await container.hunters.get())?.gold ?? 0;
    await runDailyReset(container);
    const second = await runDailyReset(container);
    expect(second.wagersResolved).toBe(0);
    expect((await container.hunters.get())?.gold).toBe(
      before + 600 + FIVE_DAY_STREAK_GOLD,
    );
  });

  it("still resolves a wager while a penalty episode is open", async () => {
    // The stake was real gold. A hunter who is stuck must not have the
    // verdict on the week they already paid for silently withheld.
    const container = await containerAtDay("2026-08-10");
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-09",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 10,
    });
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("skipped-penalty-active");
    expect(summary.wagersResolved).toBe(1);
    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe("lost");
  });

  it("resolves a wager left behind by a cron that never ran on Monday", async () => {
    // activeBefore looks at every unresolved past week, not just last one,
    // so a skipped Monday is caught the next day rather than never.
    const container = await containerAtDay("2026-08-12");
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    const summary = await runDailyReset(container);
    expect(summary.wagersResolved).toBe(1);
  });
});

describe("runDailyReset — hourglass deferral", () => {
  async function withUnfinishedQuestYesterday(container: Container) {
    await container.quests.create({
      id: "q-y",
      day: "2026-08-08",
      rank: "E",
      targetPushups: 20,
      targetSitups: 20,
      targetSquats: 20,
      targetRunKm: 1,
      createdAt: 0,
    });
  }

  it("judges an unfinished quest as missed when no grace was bought", async () => {
    const container = await containerAtDay("2026-08-09");
    await withUnfinishedQuestYesterday(container);
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("missed");
    expect(summary.penaltyOpened).toBe(true);
  });

  it("leaves the quest unjudged when yesterday carries a grace row", async () => {
    const container = await containerAtDay("2026-08-09");
    await withUnfinishedQuestYesterday(container);
    await container.mitigation.grantGrace("2026-08-08", 1);

    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("deferred-to-grace-window");
    expect(summary.penaltyOpened).toBe(false);
    // Still active, so the 04:00 cron has something to judge.
    expect((await container.quests.byDay("2026-08-08"))?.status).toBe("active");
    expect(await container.penalties.active()).toBeNull();
  });

  it("still issues today's quest on a deferred day", async () => {
    const container = await containerAtDay("2026-08-09");
    await withUnfinishedQuestYesterday(container);
    await container.mitigation.grantGrace("2026-08-08", 1);
    const summary = await runDailyReset(container);
    expect(summary.issuedToday).toBe(true);
    expect(await container.quests.byDay("2026-08-09")).not.toBeNull();
  });

  it("does not defer a quest that was already finished", async () => {
    const container = await containerAtDay("2026-08-09");
    await withUnfinishedQuestYesterday(container);
    await container.quests.setStatus("2026-08-08", "completed", 1);
    await container.mitigation.grantGrace("2026-08-08", 1);
    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("completed");
  });
});

describe("runDailyReset / runGraceReset — a deferred day must not wrongly fail the week", () => {
  /**
   * The seeded program lifts on ISO weekdays 1, 3, 5 and 6 — for the week of
   * Monday 2026-08-03 that is the 3rd, 5th, 7th and 8th (matches the Perfect
   * Week describe block above).
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

  /**
   * Every scheduled lifting day trained, and every day's Daily Quest
   * finished — EXCEPT Sunday 2026-08-09, which carries a genuine Hourglass
   * grace row. Its quest is left `active`, but the hunter has actually done
   * the work: real progress plus a real run, exactly enough to be judged
   * `completed` once the 04:00 grace window gets to it.
   */
  async function weekWithGraceOnSunday(container: Container) {
    for (const [i, day] of SCHEDULED.entries()) {
      await container.training.createSession({
        id: `s-${i}`,
        day,
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.completeSession(`s-${i}`, i + 1, "C");
    }
    // Enough runs to clear the wager's run target on its own.
    await container.training.createRun({
      id: "r-0",
      day: "2026-08-04",
      distanceKm: 3,
      durationSec: 1_200,
      loggedAt: 1,
    });
    await container.training.createRun({
      id: "r-1",
      day: "2026-08-06",
      distanceKm: 3,
      durationSec: 1_200,
      loggedAt: 2,
    });

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
      if (day === "2026-08-09") continue; // judged later, by the grace window
      await container.quests.setStatus(day, "completed", i);
    }
    await container.quests.addProgress("2026-08-09", {
      pushups: 20,
      situps: 20,
      squats: 20,
    });
    await container.training.createRun({
      id: "r-sun",
      day: "2026-08-09",
      distanceKm: 1,
      durationSec: 400,
      loggedAt: 3,
    });
    await container.mitigation.grantGrace("2026-08-09", 1);
  }

  it("skips Perfect Week and the wager on Monday 00:00 while Sunday is still deferred, then pays both once the grace window judges it complete", async () => {
    const container = await containerAtDay("2026-08-10"); // Monday
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    await weekWithGraceOnSunday(container);
    const before = (await container.hunters.get())?.gold ?? 0;

    const monday = await runDailyReset(container);
    expect(monday.perfectWeekAwarded).toBe(false);
    expect(monday.wagersResolved).toBe(0);
    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe(
      "active",
    );
    expect((await container.hunters.get())?.gold).toBe(before);
    expect(
      (
        await container.events.between(
          "2026-08-03" as never,
          "2026-08-03" as never,
        )
      ).some((e) => e.type === "PerfectWeek"),
    ).toBe(false);

    // 04:00 the same calendar day: the deferred quest is finally judged, and
    // the weekly checks that skipped it retry now that it has a final status.
    const grace = await runGraceReset(container);
    expect(grace.judged).toEqual([{ day: "2026-08-09", status: "completed" }]);

    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe("won");
    // +600 from the wager (3x the 200 stake), +500 from Perfect Week.
    expect((await container.hunters.get())?.gold).toBe(before + 600 + 500);
    const weekEvents = await container.events.between(
      "2026-08-03" as never,
      "2026-08-03" as never,
    );
    expect(weekEvents.map((e) => e.type)).toContain("PerfectWeek");
    expect(weekEvents.map((e) => e.type)).toContain("WagerWon");
  });

  it("REGRESSION: a normal week with no deferral still pays Perfect Week and the wager on Monday, unchanged", async () => {
    const container = await containerAtDay("2026-08-10");
    await container.wagers.place({
      weekStart: "2026-08-03",
      stakeGold: 200,
      placedAt: 1,
    });
    for (const [i, day] of SCHEDULED.entries()) {
      await container.training.createSession({
        id: `s-${i}`,
        day,
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.completeSession(`s-${i}`, i + 1, "C");
    }
    await container.training.createRun({
      id: "r-0",
      day: "2026-08-04",
      distanceKm: 3,
      durationSec: 1_200,
      loggedAt: 1,
    });
    await container.training.createRun({
      id: "r-1",
      day: "2026-08-06",
      distanceKm: 3,
      durationSec: 1_200,
      loggedAt: 2,
    });
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
    const before = (await container.hunters.get())?.gold ?? 0;

    const summary = await runDailyReset(container);
    expect(summary.perfectWeekAwarded).toBe(true);
    expect(summary.wagersResolved).toBe(1);
    expect((await container.wagers.byWeek("2026-08-03"))?.status).toBe("won");
    // Plus Unbroken, earned by this same fixture's seven completed quests.
    expect((await container.hunters.get())?.gold).toBe(
      before + 600 + 500 + FIVE_DAY_STREAK_GOLD,
    );
  });
});

describe("runDailyReset — fatigue decay", () => {
  it("decays fatigue for yesterday, faster when Advanced Regeneration is equipped", async () => {
    await container.hunters.update({ fatigue: 50 });
    // No session logged yesterday in this fixture — decay uses the well-rested rate.
    await runDailyReset(container);
    const restedOnly = (await container.hunters.get())?.fatigue;
    expect(restedOnly).toBe(50 - 18); // FATIGUE_TUNING.decayPerDayWellRested

    await container.hunters.update({ fatigue: 50 });
    await container.skills.seed([{ id: "advanced-regeneration" }]);
    await container.skills.learn("advanced-regeneration", 100);
    await container.skills.equip("advanced-regeneration", 100);
    // fixedClock has no advance() — move the reset's "today" forward a day by
    // swapping in a clock frozen 24h later, so this is not a same-day rerun.
    container.clock = fixedClock("2026-08-06T17:05:00.000Z");
    await runDailyReset(container);
    const withSkill = (await container.hunters.get())?.fatigue;
    expect(withSkill).toBe(50 - Math.round(18 * 1.25));
  });

  it("decays fatigue at the slower rate when a session was completed yesterday", async () => {
    await seedProgram(container.db);
    await container.training.createSession({
      id: "s-yesterday",
      day: yesterday,
      programDayId: "upper-a",
      startedAt: 1,
    });
    await container.training.completeSession("s-yesterday", 2, "C");
    await container.hunters.update({ fatigue: 50 });

    await runDailyReset(container);
    const result = (await container.hunters.get())?.fatigue;
    expect(result).toBe(50 - 12); // FATIGUE_TUNING.decayPerDay, not the well-rested rate
  });

  it("REGRESSION: decays fatigue only once however many times the cron runs on the same day", async () => {
    await container.hunters.update({ fatigue: 50 });
    await runDailyReset(container);
    await runDailyReset(container);
    await runDailyReset(container);
    const result = (await container.hunters.get())?.fatigue;
    expect(result).toBe(50 - 18);
  });

  it("still decays fatigue while a penalty episode is open — resting is not something a penalty suspends", async () => {
    await container.hunters.update({ fatigue: 50 });
    await container.penalties.create({
      id: "p1",
      startedDay: yesterday,
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 10,
    });

    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("skipped-penalty-active");
    const result = (await container.hunters.get())?.fatigue;
    expect(result).toBe(50 - 18);
  });
});

describe("runDailyReset — Job Change window checks", () => {
  it("fails an active attempt when the reset judges yesterday's Daily Quest missed", async () => {
    await container.hunters.update({ level: 40 });
    await container.skills.startJobChangeAttempt(yesterday, 1);
    await ensureDailyQuest(container, yesterday);
    // No progress logged, so the reset judges it missed.

    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("missed");
    expect(summary.events.map((e) => e.type)).toContain("JobChangeFailed");
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.failedAt).not.toBeNull();
  });

  it("fails an active attempt once its seven-day window elapses with no session logged", async () => {
    await container.hunters.update({ level: 40 });
    await container.skills.startJobChangeAttempt("2026-07-28", 1);
    const issued = await ensureDailyQuest(container, yesterday);
    if (!issued.ok) throw new Error("quest issuance failed");
    await container.quests.addProgress(yesterday, {
      pushups: issued.value.targetPushups,
      situps: issued.value.targetSitups,
      squats: issued.value.targetSquats,
    });
    await container.training.createRun({
      id: "r-jc",
      day: yesterday,
      distanceKm: issued.value.targetRunKm,
      durationSec: 400,
      loggedAt: 1,
    });

    const summary = await runDailyReset(container);
    expect(summary.yesterdayStatus).toBe("completed");
    expect(summary.events.map((e) => e.type)).toContain("JobChangeFailed");
    const attempt = await container.skills.jobChangeAttempt();
    expect(attempt?.failedAt).not.toBeNull();
  });

  it("REGRESSION: a hunter below level 40 is untouched by the reset's Job Change check", async () => {
    await container.hunters.update({ level: 39 });

    const summary = await runDailyReset(container);
    expect(summary.events.map((e) => e.type)).not.toContain("JobChangeFailed");
    expect(await container.skills.jobChangeAttempt()).toBeNull();
  });
});
