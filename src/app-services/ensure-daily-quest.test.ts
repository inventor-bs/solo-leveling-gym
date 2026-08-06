import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { parseTrainingDay } from "@/core/shared/training-day";
import { ensureDailyQuest } from "./ensure-daily-quest";

let container: Container;
const day = parseTrainingDay("2026-08-06");

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-06T03:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

describe("ensureDailyQuest", () => {
  it("fails cleanly when no hunter has been created yet", async () => {
    const result = await ensureDailyQuest(container, day);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("hunter-not-found");
  });

  it("issues a quest scaled to the hunter's current rank", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    const result = await ensureDailyQuest(container, day);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rank).toBe("E");
      expect(result.value.targetPushups).toBe(20);
      expect(result.value.targetRunKm).toBe(1);
    }
  });

  it("scales to a higher rank once the hunter has levelled", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.hunters.update({ level: 40 });
    const result = await ensureDailyQuest(container, day);
    expect(result.ok).toBe(true);
    // Level 40 sits in B-rank territory.
    if (result.ok) expect(result.value.targetPushups).toBe(60);
  });

  it("REGRESSION: is idempotent — a second call returns the same quest and does not reset progress", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    const first = await ensureDailyQuest(container, day);
    expect(first.ok).toBe(true);

    await container.quests.addProgress(day, { pushups: 15 });
    const second = await ensureDailyQuest(container, day);

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.progressPushups).toBe(15);
      expect(first.ok && second.value.id).toBe(first.ok ? first.value.id : "");
    }
  });
});
