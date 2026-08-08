import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { getNarrativeView } from "./narrative-view";

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

describe("getNarrativeView", () => {
  it("reports a dormant arc with the whole catalog sealed on day 1", async () => {
    const view = await getNarrativeView(await containerAt(1));
    expect(view.arcStage).toBe("dormant");
    expect(view.fragments).toEqual([]);
    expect(view.sealedCount).toBe(15);
    expect(view.unlockedToday).toBeNull();
  });

  it("unlocks on read, so the day-7 beat lands even if the cron is late", async () => {
    const view = await getNarrativeView(await containerAt(7));
    expect(view.fragments).toHaveLength(1);
    expect(view.fragments[0]?.id).toBe("first-anomaly");
    expect(view.arcStage).toBe("anomaly");
    expect(view.sealedCount).toBe(14);
  });

  it("carries the fragment's authored copy, not just its id", async () => {
    const view = await getNarrativeView(await containerAt(7));
    expect(view.fragments[0]?.title).toBe("Retention Notice");
    expect(view.fragments[0]?.body).toContain("Seven days of records exist.");
  });

  it("flags the fragment unlocked today so the Dashboard can announce it", async () => {
    const view = await getNarrativeView(await containerAt(7));
    expect(view.unlockedToday?.id).toBe("first-anomaly");
  });

  it("REGRESSION: stops flagging a fragment unlocked on an earlier day", async () => {
    const container = await containerAt(7);
    await getNarrativeView(container);

    const later = buildContainer({
      db: container.db,
      clock: fixedClock("2026-08-09T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    const view = await getNarrativeView(later);
    expect(view.unlockedToday).toBeNull();
    expect(view.fragments).toHaveLength(1);
  });

  it("returns an empty dormant arc when no hunter exists", async () => {
    const container = buildContainer({
      db: await makeTestDb(),
      clock: fixedClock("2026-08-08T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    const view = await getNarrativeView(container);
    expect(view.arcStage).toBe("dormant");
    expect(view.sealedCount).toBe(15);
  });
});
