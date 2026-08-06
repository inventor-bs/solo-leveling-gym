import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { ensureDailyQuest } from "./ensure-daily-quest";
import { logQuestProgress } from "./log-quest-progress";

let container: Container;
const day = parseTrainingDay("2026-08-06");

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-06T03:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

async function finishCalisthenics() {
  await logQuestProgress(container, {
    day,
    pushups: 20,
    situps: 20,
    squats: 20,
  });
}

describe("logQuestProgress", () => {
  it("fails when no quest has been issued for that day", async () => {
    const result = await logQuestProgress(container, { day, pushups: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("quest-not-found");
  });

  it("accumulates progress across calls", async () => {
    await ensureDailyQuest(container, day);
    await logQuestProgress(container, { day, pushups: 8 });
    const result = await logQuestProgress(container, { day, pushups: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quest.progressPushups).toBe(12);
  });

  it("does not complete the quest while the run is still missing", async () => {
    await ensureDailyQuest(container, day);
    await finishCalisthenics();
    const result = await logQuestProgress(container, { day, pushups: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completed).toBe(false);
      expect(result.value.quest.status).toBe("active");
    }
  });

  it("completes once the run logged in run_log covers the target", async () => {
    await ensureDailyQuest(container, day);
    await container.training.createRun({
      id: "r1",
      day,
      distanceKm: 1.2,
      durationSec: 400,
      loggedAt: 5,
    });
    await finishCalisthenics();

    const quest = await container.quests.byDay(day);
    expect(quest?.status).toBe("completed");
  });

  it("awards 50 gold exactly once, not on every later call", async () => {
    await ensureDailyQuest(container, day);
    await container.training.createRun({
      id: "r1",
      day,
      distanceKm: 1,
      durationSec: 400,
      loggedAt: 5,
    });
    await finishCalisthenics();
    await logQuestProgress(container, { day, pushups: 10 });

    const hunter = await container.hunters.get();
    expect(hunter?.gold).toBe(50);
  });

  it("emits a completion event carrying the new streak", async () => {
    await ensureDailyQuest(container, day);
    await container.training.createRun({
      id: "r1",
      day,
      distanceKm: 1,
      durationSec: 400,
      loggedAt: 5,
    });
    const result = await logQuestProgress(container, {
      day,
      pushups: 20,
      situps: 20,
      squats: 20,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const completion = result.value.events.find(
        (e) => e.type === "DailyQuestCompleted",
      );
      expect(completion).toBeDefined();
      expect(result.value.streak).toBe(1);
    }
  });

  it("REGRESSION: a negative delta cannot be used to undo progress", async () => {
    await ensureDailyQuest(container, day);
    await logQuestProgress(container, { day, pushups: 10 });
    const result = await logQuestProgress(container, { day, pushups: -50 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quest.progressPushups).toBe(10);
  });
});
