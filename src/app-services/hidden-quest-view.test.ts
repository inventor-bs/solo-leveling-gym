import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { getHiddenQuestView } from "./hidden-quest-view";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-08T02:00:00.000Z");

async function containerAt(createdDaysAgo: number): Promise<Container> {
  const container = buildContainer({
    db: await makeTestDb(),
    clock: fixedClock("2026-08-08T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({
    name: "Jin-Woo",
    createdAt: NOW - createdDaysAgo * DAY_MS,
  });
  return container;
}

describe("getHiddenQuestView", () => {
  it("REGRESSION: shows nothing at all before the quest is complete", async () => {
    const container = await containerAt(3);
    expect(await getHiddenQuestView(container)).toEqual([]);
  });

  it("reveals on read, so the day-7 card appears even if the cron is late", async () => {
    const container = await containerAt(7);
    await container.training.createRun({
      id: "r1",
      day: "2026-08-03",
      distanceKm: 2,
      durationSec: 700,
      loggedAt: 1,
    });

    const view = await getHiddenQuestView(container);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({
      id: "the-seventh-day",
      name: "The Seventh Day",
      goldAwarded: 30,
      revealedDay: "2026-08-08",
    });
    expect(view[0]?.revealLine).toContain("Hidden Quest complete");
  });

  it("keeps showing the card on later days", async () => {
    const container = await containerAt(7);
    await container.training.createRun({
      id: "r1",
      day: "2026-08-03",
      distanceKm: 2,
      durationSec: 700,
      loggedAt: 1,
    });
    await getHiddenQuestView(container);

    const later = buildContainer({
      db: container.db,
      clock: fixedClock("2026-09-08T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    expect(await getHiddenQuestView(later)).toHaveLength(1);
  });
});
