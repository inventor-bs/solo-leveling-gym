import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import { buildSystemContext } from "./system-context";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-08-08T02:00:00.000Z");

let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  await seedProgram(db);
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-08T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

describe("buildSystemContext", () => {
  it("returns null when no hunter is registered", async () => {
    expect(await buildSystemContext(container)).toBeNull();
  });

  it("carries the hunter's own facts, not placeholders", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    await container.hunters.update({
      level: 12,
      fatigue: 3.5,
      reasonForHunting: "To stop being the weakest",
      title: "unyielding",
    });

    const ctx = await buildSystemContext(container);
    expect(ctx).toMatchObject({
      hunterName: "Jin-Woo",
      level: 12,
      rank: "D",
      fatigue: 3.5,
      reasonForHunting: "To stop being the weakest",
      title: "unyielding",
      className: null,
    });
  });

  it("counts the sessions actually completed in the last seven days", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    for (const day of ["2026-08-06", "2026-08-07"]) {
      await container.training.createSession({
        id: `s-${day}`,
        day,
        programDayId: "upper-a",
        startedAt: 1,
      });
      await container.training.completeSession(`s-${day}`, 2, "C");
    }
    const ctx = await buildSystemContext(container);
    expect(ctx?.sessionsLast7d).toBe(2);
  });

  it("reports the narrative arc so the voice can know how far the story is", async () => {
    await container.hunters.create({
      name: "Jin-Woo",
      createdAt: NOW - 7 * DAY_MS,
    });
    const ctx = await buildSystemContext(container);
    expect(ctx?.arcStage).toBe("anomaly");
    expect(ctx?.unlockedFragments).toEqual(["first-anomaly"]);
  });

  it("splits lift trends into what is rising and what is falling", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    const ctx = await buildSystemContext(container);
    // No history at all yet: both lists are empty rather than fabricated.
    expect(ctx?.liftsUp).toEqual([]);
    expect(ctx?.liftsDown).toEqual([]);
  });

  it("starts with no message history and no penalty", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: NOW });
    const ctx = await buildSystemContext(container);
    expect(ctx?.lastMessages).toEqual([]);
    expect(ctx?.penaltyActive).toBe(false);
    expect(ctx?.penaltySilent).toBe(false);
    expect(ctx?.penaltyCount30d).toBe(0);
  });
});
