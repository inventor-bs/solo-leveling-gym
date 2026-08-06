import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { QuestRepo } from "./quest.repo";
import { TrainingRepo } from "./training.repo";

let db: Db;
let quests: QuestRepo;

const base = {
  id: "q1",
  day: "2026-08-06",
  rank: "E",
  targetPushups: 20,
  targetSitups: 20,
  targetSquats: 20,
  targetRunKm: 1,
  createdAt: 1_000,
};

beforeEach(async () => {
  db = await makeTestDb();
  quests = new QuestRepo(db);
});

describe("QuestRepo", () => {
  it("returns null for a day with no quest", async () => {
    expect(await quests.byDay("2026-08-06")).toBeNull();
  });

  it("creates and reads back a quest with zeroed progress", async () => {
    await quests.create(base);
    const row = await quests.byDay("2026-08-06");
    expect(row?.targetPushups).toBe(20);
    expect(row?.progressPushups).toBe(0);
    expect(row?.status).toBe("active");
    expect(row?.completedAt).toBeNull();
  });

  it("adds progress cumulatively instead of overwriting it", async () => {
    await quests.create(base);
    await quests.addProgress("2026-08-06", { pushups: 5 });
    await quests.addProgress("2026-08-06", { pushups: 7, squats: 3 });
    const row = await quests.byDay("2026-08-06");
    expect(row?.progressPushups).toBe(12);
    expect(row?.progressSquats).toBe(3);
    expect(row?.progressSitups).toBe(0);
  });

  it("records a terminal status with its timestamp", async () => {
    await quests.create(base);
    await quests.setStatus("2026-08-06", "completed", 2_000);
    const row = await quests.byDay("2026-08-06");
    expect(row?.status).toBe("completed");
    expect(row?.completedAt).toBe(2_000);
  });

  it("returns recent outcomes newest-first, flagging only completed days", async () => {
    await quests.create({ ...base, id: "a", day: "2026-08-04" });
    await quests.create({ ...base, id: "b", day: "2026-08-05" });
    await quests.create({ ...base, id: "c", day: "2026-08-06" });
    await quests.setStatus("2026-08-04", "completed", 1);
    await quests.setStatus("2026-08-05", "missed", 1);

    const outcomes = await quests.recentOutcomes(60);
    expect(outcomes).toEqual([
      { day: "2026-08-06", completed: false },
      { day: "2026-08-05", completed: false },
      { day: "2026-08-04", completed: true },
    ]);
  });
});

describe("TrainingRepo.kmOnDay", () => {
  it("is 0 when nothing was run that day", async () => {
    const training = new TrainingRepo(db);
    expect(await training.kmOnDay("2026-08-06")).toBe(0);
  });

  it("sums every run logged on that day and ignores other days", async () => {
    const training = new TrainingRepo(db);
    await training.createRun({
      id: "r1",
      day: "2026-08-06",
      distanceKm: 2.5,
      durationSec: 900,
      loggedAt: 1,
    });
    await training.createRun({
      id: "r2",
      day: "2026-08-06",
      distanceKm: 1.5,
      durationSec: 600,
      loggedAt: 2,
    });
    await training.createRun({
      id: "r3",
      day: "2026-08-05",
      distanceKm: 9,
      durationSec: 100,
      loggedAt: 3,
    });
    expect(await training.kmOnDay("2026-08-06")).toBe(4);
  });
});
