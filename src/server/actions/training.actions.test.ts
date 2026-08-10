import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "s".repeat(32) }),
}));

const containerModule = await import("@/server/container");
const { makeTestDb } = await import("@/infra/db/testing/make-test-db");
const { seedProgram } = await import("@/infra/db/seed/program");
const { signSession, SESSION_COOKIE } = await import("@/server/auth/session");
const {
  startSessionAction,
  logSetAction,
  completeSessionAction,
  logRunAction,
} = await import("./training.actions");

function givenAuthenticated(authenticated: boolean) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name !== SESSION_COOKIE) return undefined;
    if (!authenticated) return undefined;
    return { value: signSession(Date.now() + 60_000, "s".repeat(32)) };
  });
}

beforeEach(async () => {
  cookieStore.get.mockReset();
  const db = await makeTestDb();
  await seedProgram(db);
  // Server actions call getContainer(), a singleton over the real production
  // DB path. This test verifies the AUTH GATE, so getContainer is pointed
  // at an injected test DB — full app-service behavior is already covered
  // by the dedicated app-services tests.
  vi.spyOn(containerModule, "getContainer").mockReturnValue(
    containerModule.buildContainer({ db, tzOffsetMinutes: 420 }),
  );
});

describe("training server actions — auth gate", () => {
  it("startSessionAction reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await startSessionAction({ programDayId: "upper-a" });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("startSessionAction succeeds when authenticated", async () => {
    givenAuthenticated(true);
    const result = await startSessionAction({ programDayId: "upper-a" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sessionId).toBeTruthy();
  });

  it("startSessionAction passes dungeonTypeOverrides through to the session plan", async () => {
    givenAuthenticated(true);
    await containerModule.getContainer().store.unlock("dungeon-type:amrap", 1);

    const result = await startSessionAction({
      programDayId: "upper-a",
      dungeonTypeOverrides: { "bench-press": "amrap" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const benchPress = result.value.plan.find(
      (p) => p.exerciseId === "bench-press",
    );
    expect(benchPress?.dungeonType).toBe("amrap");
  });

  it("startSessionAction rejects a dungeonTypeOverrides value that isn't a real dungeon type", async () => {
    givenAuthenticated(true);
    const result = await startSessionAction({
      programDayId: "upper-a",
      dungeonTypeOverrides: { "bench-press": "standard" },
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("logSetAction reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await logSetAction({
      sessionId: "x",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("logSetAction reports invalid input (negative weight) before touching the DB", async () => {
    givenAuthenticated(true);
    const result = await logSetAction({
      sessionId: "x",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: -10,
      completed: true,
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("completeSessionAction reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await completeSessionAction({ sessionId: "x" });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("logRunAction reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await logRunAction({
      day: "2026-08-05",
      distanceKm: 5,
      durationSec: 1800,
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("logRunAction succeeds when authenticated with valid input", async () => {
    givenAuthenticated(true);
    const result = await logRunAction({
      day: "2026-08-05",
      distanceKm: 5,
      durationSec: 1800,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.runId).toBeTruthy();
  });
});

describe("training server actions — domain errors surface as data", () => {
  /**
   * These are the cases that produced an opaque HTTP 500 and a bare
   * "An error occurred in the Server Components render" in the browser.
   * A user hitting them must get something they can act on.
   */
  it("REGRESSION: an unseeded program day reports program-day-not-found, not a crash", async () => {
    givenAuthenticated(true);
    const result = await startSessionAction({ programDayId: "does-not-exist" });
    expect(result).toEqual({ ok: false, error: "program-day-not-found" });
  });

  it("REGRESSION: completing an unknown session reports session-not-found, not a crash", async () => {
    givenAuthenticated(true);
    const result = await completeSessionAction({ sessionId: "nope" });
    expect(result).toEqual({ ok: false, error: "session-not-found" });
  });

  it("REGRESSION: logging a set against an unknown session does not crash", async () => {
    givenAuthenticated(true);
    const result = await logSetAction({
      sessionId: "nope",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
    });
    expect(result.ok).toBe(false);
  });
});
