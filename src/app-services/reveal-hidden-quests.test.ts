import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { addDays, type TrainingDay } from "@/core/shared/training-day";
import { kg } from "@/core/shared/units";
import { revealHiddenQuests } from "./reveal-hidden-quests";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-08T02:00:00.000Z");

async function containerAt(createdDaysAgo: number): Promise<Container> {
  const db = await makeTestDb();
  await seedProgram(db);
  const container = buildContainer({
    db,
    clock: fixedClock("2026-08-08T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({
    name: "Jin-Woo",
    createdAt: NOW - createdDaysAgo * DAY_MS,
  });
  return container;
}

/**
 * A completed session on `day`, the cheapest possible "this day was active".
 * `startedAt` defaults to an instant whose local hour (tzOffsetMinutes 420)
 * is exactly 07:00 — never before MORNING_BEFORE_HOUR — so callers that
 * don't care about Early Riser can't trigger it by accident.
 */
async function logSessionOn(
  container: Container,
  day: string,
  startedAt = 1,
): Promise<void> {
  const id = `s-${day}`;
  await container.training.createSession({
    id,
    day,
    programDayId: "upper-a",
    startedAt,
  });
  await container.training.completeSession(id, 2, "E");
}

/** `days` consecutive completed Daily Quests ending on `endDay`. */
async function completedQuestStreak(
  container: Container,
  days: number,
  endDay: TrainingDay,
): Promise<void> {
  let day = endDay;
  for (let i = 0; i < days; i += 1) {
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
    day = addDays(day, -1);
  }
}

describe("revealHiddenQuests", () => {
  it("does nothing without a hunter", async () => {
    const container = buildContainer({
      db: await makeTestDb(),
      clock: fixedClock("2026-08-08T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    expect(await revealHiddenQuests(container)).toEqual([]);
  });

  it("reveals nothing on day 6", async () => {
    const container = await containerAt(6);
    await logSessionOn(container, "2026-08-03");
    expect(await revealHiddenQuests(container)).toEqual([]);
    expect(await container.hiddenQuests.all()).toEqual([]);
  });

  it("REGRESSION: reveals nothing on day 7 when the week was empty", async () => {
    const container = await containerAt(7);
    expect(await revealHiddenQuests(container)).toEqual([]);
    expect(await container.hiddenQuests.all()).toEqual([]);
  });

  it("reveals on day 7 and pays for the days actually trained", async () => {
    const container = await containerAt(7);
    // The window is 2026-08-01 .. 2026-08-07 for a hunter registered on
    // 2026-08-01 ICT. Two active days inside it.
    await logSessionOn(container, "2026-08-02");
    await logSessionOn(container, "2026-08-05");

    const events = await revealHiddenQuests(container);
    expect(events).toEqual([
      {
        type: "HiddenQuestRevealed",
        questId: "the-seventh-day",
        questName: "The Seventh Day",
        goldAwarded: 60,
      },
      { type: "GoldGained", amount: 60, source: "hidden-quest" },
    ]);
    expect((await container.hunters.get())?.gold).toBe(60);
  });

  it("counts a logged run as an active day", async () => {
    const container = await containerAt(7);
    await container.training.createRun({
      id: "r1",
      day: "2026-08-03",
      distanceKm: 2,
      durationSec: 700,
      loggedAt: 1,
    });
    const events = await revealHiddenQuests(container);
    expect(events[0]).toMatchObject({ goldAwarded: 30 });
  });

  it("REGRESSION: never counts the same day twice for a session and a run", async () => {
    const container = await containerAt(7);
    await logSessionOn(container, "2026-08-03");
    await container.training.createRun({
      id: "r1",
      day: "2026-08-03",
      distanceKm: 2,
      durationSec: 700,
      loggedAt: 1,
    });
    const events = await revealHiddenQuests(container);
    expect(events[0]).toMatchObject({ goldAwarded: 30 });
  });

  it("REGRESSION: ignores training done after the first seven days", async () => {
    const container = await containerAt(30);
    // Registered 2026-07-09 ICT, so the window closes on 2026-07-15.
    await logSessionOn(container, "2026-07-10");
    await logSessionOn(container, "2026-08-01");
    const events = await revealHiddenQuests(container);
    expect(events[0]).toMatchObject({ goldAwarded: 30 });
  });

  it("REGRESSION: pays exactly once, however many times it runs", async () => {
    const container = await containerAt(7);
    await logSessionOn(container, "2026-08-02");
    await revealHiddenQuests(container);
    expect(await revealHiddenQuests(container)).toEqual([]);
    expect((await container.hunters.get())?.gold).toBe(30);
  });

  it("persists the reveal into the event log", async () => {
    const container = await containerAt(7);
    await logSessionOn(container, "2026-08-02");
    await revealHiddenQuests(container);
    const rows = await container.events.between(
      "2026-08-08" as never,
      "2026-08-08" as never,
    );
    expect(rows.map((r) => r.type)).toContain("HiddenQuestRevealed");
  });

  it("reveals Early Riser the first time a session started before 07:00", async () => {
    const container = await containerAt(7);
    // Local hour 6 at tzOffsetMinutes 420 — one hour before MORNING_BEFORE_HOUR.
    await logSessionOn(container, "2026-08-02", -3_600_000);
    const events = await revealHiddenQuests(container);
    expect(
      events.some(
        (e) => e.type === "HiddenQuestRevealed" && e.questId === "early-riser",
      ),
    ).toBe(true);
  });

  it("reveals First Record the first time a PR has ever been logged", async () => {
    const container = await containerAt(7);
    await container.events.record(
      [
        {
          type: "PrAchieved",
          exerciseId: "squat",
          newE1rm: kg(100),
          previousE1rm: kg(90),
        },
      ],
      "2026-08-08" as TrainingDay,
      1,
    );
    const events = await revealHiddenQuests(container);
    expect(
      events.some(
        (e) => e.type === "HiddenQuestRevealed" && e.questId === "first-record",
      ),
    ).toBe(true);
  });

  it("reveals Unbroken at a 5-day streak, or a 3-day streak with Stealth equipped", async () => {
    const container = await containerAt(7);
    await container.skills.seed([{ id: "stealth" }]);
    await container.skills.learn("stealth", 100);
    await container.skills.equip("stealth", 100);
    await completedQuestStreak(container, 3, "2026-08-08" as TrainingDay);
    const events = await revealHiddenQuests(container);
    expect(
      events.some(
        (e) =>
          e.type === "HiddenQuestRevealed" && e.questId === "five-day-streak",
      ),
    ).toBe(true);
  });

  it("never reveals the same hidden quest twice", async () => {
    const container = await containerAt(7);
    await logSessionOn(container, "2026-08-02", -3_600_000);
    await container.skills.seed([{ id: "stealth" }]);
    await container.skills.learn("stealth", 100);
    await container.skills.equip("stealth", 100);
    await completedQuestStreak(container, 3, "2026-08-08" as TrainingDay);
    await container.events.record(
      [
        {
          type: "PrAchieved",
          exerciseId: "squat",
          newE1rm: kg(100),
          previousE1rm: kg(90),
        },
      ],
      "2026-08-08" as TrainingDay,
      1,
    );

    const first = await revealHiddenQuests(container);
    expect(first.length).toBeGreaterThan(0);
    const second = await revealHiddenQuests(container);
    expect(second).toEqual([]);
  });
});
