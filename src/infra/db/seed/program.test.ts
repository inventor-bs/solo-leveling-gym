import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "../testing/make-test-db";
import { seedProgram } from "./program";
import { exercise, programDay, programDayExercise } from "../schema";

describe("seedProgram", () => {
  it("creates all four program days", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const days = await db.select().from(programDay);
    expect(days.map((d) => d.id).sort()).toEqual([
      "lower-a",
      "lower-b",
      "upper-a",
      "upper-b",
    ]);
  });

  it("creates every exercise referenced by a program day", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const benchRows = await db
      .select()
      .from(exercise)
      .where(eq(exercise.id, "bench-press"));
    expect(benchRows).toHaveLength(1);
    expect(benchRows[0]?.muscle).toBe("chest");
    expect(benchRows[0]?.isMainLift).toBe(true);
  });

  it("Upper A has 6 prescribed exercises in the documented order", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const slots = await db
      .select()
      .from(programDayExercise)
      .where(eq(programDayExercise.programDayId, "upper-a"));
    expect(slots).toHaveLength(6);
    const benchSlot = slots.find((s) => s.exerciseId === "bench-press");
    expect(benchSlot).toMatchObject({ targetSets: 4, repMin: 6, repMax: 8 });
  });

  it("is idempotent — calling it twice doesn't duplicate or throw", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    await seedProgram(db);
    const days = await db.select().from(programDay);
    expect(days).toHaveLength(4);
  });
});
