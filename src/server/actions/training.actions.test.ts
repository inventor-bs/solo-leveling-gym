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
  it("startSessionAction rejects when unauthenticated", async () => {
    givenAuthenticated(false);
    await expect(
      startSessionAction({ programDayId: "upper-a" }),
    ).rejects.toThrow();
  });

  it("startSessionAction succeeds when authenticated", async () => {
    givenAuthenticated(true);
    const result = await startSessionAction({ programDayId: "upper-a" });
    expect(result.sessionId).toBeTruthy();
  });

  it("logSetAction rejects when unauthenticated", async () => {
    givenAuthenticated(false);
    await expect(
      logSetAction({
        sessionId: "x",
        exerciseId: "bench-press",
        setIndex: 0,
        reps: 6,
        weight: 80,
        completed: true,
      }),
    ).rejects.toThrow();
  });

  it("logSetAction rejects invalid input (negative weight) before touching the DB", async () => {
    givenAuthenticated(true);
    await expect(
      logSetAction({
        sessionId: "x",
        exerciseId: "bench-press",
        setIndex: 0,
        reps: 6,
        weight: -10,
        completed: true,
      }),
    ).rejects.toThrow();
  });

  it("completeSessionAction rejects when unauthenticated", async () => {
    givenAuthenticated(false);
    await expect(completeSessionAction({ sessionId: "x" })).rejects.toThrow();
  });

  it("logRunAction rejects when unauthenticated", async () => {
    givenAuthenticated(false);
    await expect(
      logRunAction({ day: "2026-08-05", distanceKm: 5, durationSec: 1800 }),
    ).rejects.toThrow();
  });

  it("logRunAction succeeds when authenticated with valid input", async () => {
    givenAuthenticated(true);
    const result = await logRunAction({
      day: "2026-08-05",
      distanceKm: 5,
      durationSec: 1800,
    });
    expect(result.runId).toBeTruthy();
  });
});
