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
const { signSession, SESSION_COOKIE } = await import("@/server/auth/session");
const { ensureDailyQuest } = await import("@/app-services/ensure-daily-quest");
const { parseTrainingDay } = await import("@/core/shared/training-day");
const { logQuestProgressAction } = await import("./quest.actions");

const day = parseTrainingDay("2026-08-06");

function givenAuthenticated(authenticated: boolean) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name !== SESSION_COOKIE || !authenticated) return undefined;
    return { value: signSession(Date.now() + 60_000, "s".repeat(32)) };
  });
}

beforeEach(async () => {
  cookieStore.get.mockReset();
  const db = await makeTestDb();
  const { fixedClock } = await import("@/infra/clock/system-clock");
  const container = containerModule.buildContainer({
    db,
    clock: fixedClock("2026-08-06T03:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  vi.spyOn(containerModule, "getContainer").mockReturnValue(container);
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
});

describe("logQuestProgressAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await logQuestProgressAction({ day, pushups: 5 });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a malformed day", async () => {
    givenAuthenticated(true);
    const result = await logQuestProgressAction({
      day: "06/08/2026",
      pushups: 5,
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("REGRESSION: a well-shaped but impossible date is rejected, not thrown on", async () => {
    // "2026-02-30" satisfies the regex but is not a real day. parseTrainingDay
    // throws on it, and a throw here would reach the browser as an opaque
    // Server Components error — the exact failure mode ActionResult exists
    // to prevent.
    givenAuthenticated(true);
    const result = await logQuestProgressAction({
      day: "2026-02-30",
      pushups: 5,
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("rejects an absurd rep count rather than storing it", async () => {
    givenAuthenticated(true);
    const result = await logQuestProgressAction({ day, pushups: 100_000 });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("reports quest-not-found when no quest exists for the day", async () => {
    givenAuthenticated(true);
    const result = await logQuestProgressAction({ day, pushups: 5 });
    expect(result).toEqual({ ok: false, error: "quest-not-found" });
  });

  it("records progress when authenticated", async () => {
    givenAuthenticated(true);
    await ensureDailyQuest(containerModule.getContainer(), day);
    const result = await logQuestProgressAction({ day, pushups: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quest.progressPushups).toBe(5);
  });
});
