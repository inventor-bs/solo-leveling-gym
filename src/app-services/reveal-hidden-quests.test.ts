import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
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

/** A completed session on `day`, the cheapest possible "this day was active". */
async function logSessionOn(container: Container, day: string): Promise<void> {
  const id = `s-${day}`;
  await container.training.createSession({
    id,
    day,
    programDayId: "upper-a",
    startedAt: 1,
  });
  await container.training.completeSession(id, 2, "E");
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
});
