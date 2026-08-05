import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../testing/make-test-db";
import { seedProgram } from "../seed/program";
import { ExerciseRepo } from "./exercise.repo";
import type { Db } from "../client";

let db: Db;
let repo: ExerciseRepo;

beforeEach(async () => {
  db = await makeTestDb();
  await seedProgram(db);
  repo = new ExerciseRepo(db);
});

describe("ExerciseRepo", () => {
  it("byId returns a seeded exercise", async () => {
    const e = await repo.byId("bench-press");
    expect(e?.name).toBe("Bench Press");
    expect(e?.muscle).toBe("chest");
  });

  it("byId returns null for an unknown id", async () => {
    expect(await repo.byId("not-a-real-exercise")).toBeNull();
  });

  it("all returns every seeded exercise", async () => {
    const all = await repo.all();
    expect(all.length).toBeGreaterThanOrEqual(24);
  });
});
