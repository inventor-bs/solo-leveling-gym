import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import type { Db } from "../client";
import { EventLogRepo } from "./event-log.repo";
import type { TrainingDay } from "@/core/shared/training-day";
import { kg } from "@/core/shared/units";

let db: Db;
let events: EventLogRepo;

beforeEach(async () => {
  db = await makeTestDb();
  events = new EventLogRepo(db);
});

describe("EventLogRepo", () => {
  it("is empty before anything is recorded", async () => {
    expect(
      await events.between(
        "2026-01-01" as TrainingDay,
        "2026-12-31" as TrainingDay,
      ),
    ).toEqual([]);
  });

  it("records every event in a batch, stamped with the given day", async () => {
    await events.record(
      [
        { type: "ShadowArisen", shadowId: "igris", shadowName: "Igris" },
        { type: "LevelUp", from: 4, to: 5 },
      ],
      "2026-08-06" as TrainingDay,
      1000,
    );
    const rows = await events.between(
      "2026-08-01" as TrainingDay,
      "2026-08-31" as TrainingDay,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.day === ("2026-08-06" as TrainingDay))).toBe(
      true,
    );
    expect(rows.every((r) => r.occurredAt === 1000)).toBe(true);
    expect(rows.map((r) => r.type).sort()).toEqual(["LevelUp", "ShadowArisen"]);
  });

  it("stores the event's own fields as parseable JSON payload", async () => {
    await events.record(
      [
        {
          type: "PrAchieved",
          exerciseId: "bench-press",
          newE1rm: kg(100),
          previousE1rm: kg(95),
        },
      ],
      "2026-08-06" as TrainingDay,
      1000,
    );
    const [row] = await events.between(
      "2026-08-06" as TrainingDay,
      "2026-08-06" as TrainingDay,
    );
    const payload = JSON.parse(row!.payload);
    expect(payload).toEqual({
      exerciseId: "bench-press",
      newE1rm: 100,
      previousE1rm: 95,
    });
  });

  it("does nothing on an empty batch — no empty row, no crash", async () => {
    await events.record([], "2026-08-06" as TrainingDay, 1000);
    expect(
      await events.between(
        "2026-08-01" as TrainingDay,
        "2026-08-31" as TrainingDay,
      ),
    ).toEqual([]);
  });

  it("REGRESSION: between() excludes events outside the requested day range", async () => {
    await events.record(
      [{ type: "LevelUp", from: 1, to: 2 }],
      "2026-07-31" as TrainingDay,
      1,
    );
    await events.record(
      [{ type: "LevelUp", from: 2, to: 3 }],
      "2026-08-01" as TrainingDay,
      2,
    );
    await events.record(
      [{ type: "LevelUp", from: 3, to: 4 }],
      "2026-08-31" as TrainingDay,
      3,
    );
    await events.record(
      [{ type: "LevelUp", from: 4, to: 5 }],
      "2026-09-01" as TrainingDay,
      4,
    );
    const rows = await events.between(
      "2026-08-01" as TrainingDay,
      "2026-08-31" as TrainingDay,
    );
    expect(rows).toHaveLength(2);
  });

  it("orders results oldest first", async () => {
    await events.record(
      [{ type: "LevelUp", from: 1, to: 2 }],
      "2026-08-02" as TrainingDay,
      200,
    );
    await events.record(
      [{ type: "LevelUp", from: 2, to: 3 }],
      "2026-08-01" as TrainingDay,
      100,
    );
    const rows = await events.between(
      "2026-08-01" as TrainingDay,
      "2026-08-31" as TrainingDay,
    );
    expect(rows.map((r) => r.occurredAt)).toEqual([100, 200]);
  });

  it("REGRESSION: orders by day first, even when a later day's event has an earlier occurredAt", async () => {
    // daily-reset deliberately stamps yesterday's judged events with TODAY's
    // occurredAt, so occurredAt alone is not a reliable timeline order — a
    // late cron run can give an earlier day a LATER occurredAt than a day
    // that follows it. The timeline must still read oldest-day-first.
    await events.record(
      [{ type: "LevelUp", from: 2, to: 3 }],
      "2026-08-08" as TrainingDay,
      100,
    );
    await events.record(
      [{ type: "LevelUp", from: 1, to: 2 }],
      "2026-08-07" as TrainingDay,
      200,
    );
    const rows = await events.between(
      "2026-08-01" as TrainingDay,
      "2026-08-31" as TrainingDay,
    );
    expect(rows.map((r) => r.day)).toEqual(["2026-08-07", "2026-08-08"]);
  });
});
