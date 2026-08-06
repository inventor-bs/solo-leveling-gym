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
    expect(second.yesterdayStatus).toBe("missed");
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
