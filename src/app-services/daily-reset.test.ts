import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
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
    expect(yesterdayRows.some((r) => r.type === "DailyQuestMissed")).toBe(true);
    expect(yesterdayRows.some((r) => r.type === "PenaltyStarted")).toBe(true);

    const today = parseTrainingDay(summary.today);
    const todayRows = await container.events.between(today, today);
    expect(todayRows.length).toBe(0);
  });
});
