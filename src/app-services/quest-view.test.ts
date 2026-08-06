import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { buildContainer, type Container } from "@/server/container";
import { fixedClock } from "@/infra/clock/system-clock";
import { getQuestView } from "./quest-view";

let container: Container;

beforeEach(async () => {
  const db = await makeTestDb();
  container = buildContainer({
    db,
    clock: fixedClock("2026-08-06T03:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
});

describe("getQuestView", () => {
  it("fails cleanly before onboarding", async () => {
    const result = await getQuestView(container);
    expect(result.ok).toBe(false);
  });

  it("issues the quest on first read so the page is never empty", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    const result = await getQuestView(container);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.day).toBe("2026-08-06");
      expect(result.value.targets.pushups).toBe(20);
      expect(result.value.progress.pushups).toBe(0);
      expect(result.value.percent).toBe(0);
      expect(result.value.complete).toBe(false);
      expect(result.value.streak).toBe(0);
    }
  });

  it("reads run distance from run_log rather than from the quest row", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await getQuestView(container);
    await container.training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 0.5,
      durationSec: 200,
      loggedAt: 1,
    });

    const result = await getQuestView(container);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.progress.runKm).toBe(0.5);
  });
});
