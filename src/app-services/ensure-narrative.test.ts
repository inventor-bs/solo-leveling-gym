import { describe, it, expect } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { ensureNarrativeUnlocks } from "./ensure-narrative";

const DAY_MS = 86_400_000;
/** 2026-08-08T09:00 ICT. */
const NOW = Date.parse("2026-08-08T02:00:00.000Z");

async function containerAt(createdDaysAgo: number): Promise<Container> {
  const db = await makeTestDb();
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

describe("ensureNarrativeUnlocks", () => {
  it("does nothing when there is no hunter yet", async () => {
    const container = buildContainer({
      db: await makeTestDb(),
      clock: fixedClock("2026-08-08T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    expect(await ensureNarrativeUnlocks(container)).toEqual([]);
  });

  it("unlocks nothing on day 6", async () => {
    const container = await containerAt(6);
    expect(await ensureNarrativeUnlocks(container)).toEqual([]);
    expect(await container.narrative.unlockedIds()).toEqual([]);
  });

  it("unlocks the first fragment on day 7", async () => {
    const container = await containerAt(7);
    const events = await ensureNarrativeUnlocks(container);
    expect(events).toEqual([
      {
        type: "NarrativeFragmentUnlocked",
        fragmentId: "first-anomaly",
        ordinal: 1,
      },
    ]);
    expect(await container.narrative.unlockedIds()).toEqual(["first-anomaly"]);
  });

  it("persists the unlock into the event log", async () => {
    const container = await containerAt(7);
    await ensureNarrativeUnlocks(container);
    const rows = await container.events.between(
      "2026-08-08" as never,
      "2026-08-08" as never,
    );
    expect(rows.map((r) => r.type)).toContain("NarrativeFragmentUnlocked");
  });

  it("REGRESSION: is idempotent — a second call on the same day unlocks nothing", async () => {
    const container = await containerAt(14);
    await ensureNarrativeUnlocks(container);
    const second = await ensureNarrativeUnlocks(container);
    expect(second).toEqual([]);
    expect(await container.narrative.unlockedIds()).toEqual(["first-anomaly"]);
  });

  it("REGRESSION: releases a backlog one fragment per calendar day, not all at once", async () => {
    // Day 40 satisfies fragments 1, 2 and 3 simultaneously.
    const container = await containerAt(40);
    await ensureNarrativeUnlocks(container);
    expect(await container.narrative.unlockedIds()).toEqual(["first-anomaly"]);

    // A different day: the arc advances by exactly one more.
    const tomorrow = buildContainer({
      db: container.db,
      clock: fixedClock("2026-08-09T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await ensureNarrativeUnlocks(tomorrow);
    expect(await tomorrow.narrative.unlockedIds()).toEqual([
      "first-anomaly",
      "maintenance-window",
    ]);
  });

  it("unlocks the second fragment on day 14 for a hunter who read the first on day 7", async () => {
    const container = await containerAt(7);
    await ensureNarrativeUnlocks(container);

    const later = buildContainer({
      db: container.db,
      clock: fixedClock("2026-08-15T02:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    const events = await ensureNarrativeUnlocks(later);
    expect(events[0]).toMatchObject({ fragmentId: "maintenance-window" });
  });
});
