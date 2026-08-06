import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { PenaltyRepo } from "./penalty.repo";
import { TrainingRepo } from "./training.repo";
import { ProgramRepo } from "./program.repo";
import { seedProgram } from "../seed/program";

let db: Db;
let penalties: PenaltyRepo;

const base = {
  id: "p1",
  startedDay: "2026-08-05",
  startedAt: 1_000,
  reason: "daily-quest-missed",
  variantId: 1,
  expLost: 25,
};

beforeEach(async () => {
  db = await makeTestDb();
  penalties = new PenaltyRepo(db);
});

describe("PenaltyRepo", () => {
  it("reports no active penalty on a clean slate", async () => {
    expect(await penalties.active()).toBeNull();
    expect(await penalties.countAll()).toBe(0);
  });

  it("treats a row with no end timestamp as active", async () => {
    await penalties.create(base);
    const row = await penalties.active();
    expect(row?.id).toBe("p1");
    expect(row?.endedAt).toBeNull();
    expect(row?.expLost).toBe(25);
  });

  it("stops reporting a closed penalty as active but still counts it", async () => {
    await penalties.create(base);
    await penalties.close("p1", 5_000);
    expect(await penalties.active()).toBeNull();
    expect(await penalties.countAll()).toBe(1);
  });

  it("REGRESSION: counts closed episodes, since the variant rotates on history", async () => {
    await penalties.create(base);
    await penalties.close("p1", 2);
    await penalties.create({ ...base, id: "p2", startedDay: "2026-08-09" });
    await penalties.close("p2", 3);
    expect(await penalties.countAll()).toBe(2);
    expect(await penalties.active()).toBeNull();
  });

  it("returns the most recent one when several are open", async () => {
    await penalties.create(base);
    await penalties.create({
      ...base,
      id: "p2",
      startedDay: "2026-08-08",
      startedAt: 9_000,
    });
    expect((await penalties.active())?.id).toBe("p2");
  });
});

describe("TrainingRepo activity lookups", () => {
  it("has no last activity day on an empty log", async () => {
    expect(await new TrainingRepo(db).lastActivityDay()).toBeNull();
  });

  it("reports the latest day across both completed sessions and runs", async () => {
    const training = new TrainingRepo(db);
    await seedProgram(db);
    await training.createSession({
      id: "s1",
      day: "2026-08-01",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await training.completeSession("s1", 2, "C");
    await training.createRun({
      id: "r1",
      day: "2026-08-04",
      distanceKm: 3,
      durationSec: 900,
      loggedAt: 3,
    });
    expect(await training.lastActivityDay()).toBe("2026-08-04");
  });

  it("REGRESSION: ignores a session that was started but never completed", async () => {
    // An abandoned session is not training. Counting it would silently
    // reset the dormancy clock and hide the Reawakening Test.
    const training = new TrainingRepo(db);
    await seedProgram(db);
    await training.createSession({
      id: "s1",
      day: "2026-08-01",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await training.completeSession("s1", 2, "C");
    await training.createSession({
      id: "s2",
      day: "2026-08-20",
      programDayId: "lower-a",
      startedAt: 3,
    });
    expect(await training.lastActivityDay()).toBe("2026-08-01");
  });

  it("lists the days that carry a completed session inside a range", async () => {
    const training = new TrainingRepo(db);
    await seedProgram(db);
    await training.createSession({
      id: "s1",
      day: "2026-08-03",
      programDayId: "upper-a",
      startedAt: 1,
    });
    await training.completeSession("s1", 2, "C");
    const days = await training.completedSessionDaysBetween(
      "2026-08-01",
      "2026-08-06",
    );
    expect(days).toEqual(["2026-08-03"]);
  });
});

describe("ProgramRepo.allDays", () => {
  it("returns every scheduled lifting weekday", async () => {
    await seedProgram(db);
    const days = await new ProgramRepo(db).allDays();
    expect(days.map((d) => d.weekday).sort()).toEqual([1, 3, 5, 6]);
  });
});
