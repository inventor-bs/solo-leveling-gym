import { describe, it, expect, beforeEach } from "vitest";
import { buildContainer, type Container } from "@/server/container";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { fixedClock } from "@/infra/clock/system-clock";
import { seedProgram } from "@/infra/db/seed/program";
import { depositSession } from "./deposit-session";

describe("depositSession", () => {
  let container: Container;

  beforeEach(async () => {
    const db = await makeTestDb();
    container = buildContainer({
      db,
      clock: fixedClock("2026-08-11T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    await seedProgram(db);
    await container.skills.seed([{ id: "shadow-storage" }]);
    await container.skills.learn("shadow-storage", 100);
    await container.skills.equip("shadow-storage", 100);
  });

  it("refuses without Shadow Storage learned and equipped", async () => {
    await container.skills.unequip("shadow-storage");
    const result = await depositSession(container);
    expect(result).toEqual({
      ok: false,
      error: { type: "skill-not-equipped" },
    });
  });

  it("refuses when there is no completed session to deposit", async () => {
    const result = await depositSession(container);
    expect(result).toEqual({
      ok: false,
      error: { type: "no-session-to-deposit" },
    });
  });

  it("refuses when the most recently completed session was on a scheduled weekday", async () => {
    // Upper A is seeded on weekday 1 (Monday) — 2026-08-10 is a Monday.
    await container.training.createSession({
      id: "s1",
      day: "2026-08-10",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.completeSession("s1", 100, "C");

    const result = await depositSession(container);
    expect(result).toEqual({
      ok: false,
      error: { type: "not-a-surplus-session" },
    });
  });

  it("deposits a session completed on an unscheduled weekday", async () => {
    // 2026-08-11 is a Tuesday — not one of the seeded program's weekdays.
    await container.training.createSession({
      id: "s1",
      day: "2026-08-11",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.completeSession("s1", 100, "C");

    const result = await depositSession(container);
    expect(result.ok).toBe(true);
    expect(await container.skills.bank()).toMatchObject({ bankedSessions: 1 });
  });

  it("refuses to deposit the same session twice", async () => {
    await container.training.createSession({
      id: "s1",
      day: "2026-08-11",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.completeSession("s1", 100, "C");

    await depositSession(container);
    const second = await depositSession(container);
    expect(second).toEqual({ ok: false, error: { type: "already-deposited" } });
  });
});
