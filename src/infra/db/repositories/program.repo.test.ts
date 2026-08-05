import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { seedProgram } from "../seed/program";
import { ProgramRepo } from "./program.repo";
import type { Db } from "../client";

let db: Db;
let repo: ProgramRepo;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  repo = new ProgramRepo(db);
});

describe("ProgramRepo", () => {
  it("byId returns the program day with its exercises in order", async () => {
    const day = await repo.byId("upper-a");
    expect(day?.programDay.name).toBe("Upper A");
    expect(day?.exercises).toHaveLength(6);
    expect(day?.exercises[0]?.exercise.id).toBe("bench-press");
    expect(day?.exercises[0]?.slot.targetSets).toBe(4);
  });

  it("byId returns null for an unknown program day", async () => {
    expect(await repo.byId("not-a-real-day")).toBeNull();
  });

  it("byWeekday finds the right day (Monday = Upper A)", async () => {
    const day = await repo.byWeekday(1);
    expect(day?.programDay.id).toBe("upper-a");
  });

  it("byWeekday returns null for a rest day (Sunday)", async () => {
    expect(await repo.byWeekday(7)).toBeNull();
  });
});
