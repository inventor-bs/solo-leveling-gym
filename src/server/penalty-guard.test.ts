import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "s".repeat(32) }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const containerModule = await import("@/server/container");
const { makeTestDb } = await import("@/infra/db/testing/make-test-db");
const { signSession, SESSION_COOKIE } = await import("@/server/auth/session");
const navigationModule = await import("next/navigation");
const { redirectOwnerIfPenalised } = await import("./penalty-guard");

function givenAuthenticated(authenticated: boolean) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name !== SESSION_COOKIE) return undefined;
    if (!authenticated) return undefined;
    return { value: signSession(Date.now() + 60_000, "s".repeat(32)) };
  });
}

let container: ReturnType<typeof containerModule.buildContainer>;

beforeEach(async () => {
  cookieStore.get.mockReset();
  vi.mocked(navigationModule.redirect).mockClear();
  const db = await makeTestDb();
  container = containerModule.buildContainer({ db, tzOffsetMinutes: 420 });
  vi.spyOn(containerModule, "getContainer").mockReturnValue(container);
});

describe("redirectOwnerIfPenalised", () => {
  it("does not redirect the owner when no penalty is active", async () => {
    givenAuthenticated(true);
    await redirectOwnerIfPenalised();
    expect(navigationModule.redirect).not.toHaveBeenCalled();
  });

  it("redirects the owner to /penalty when a penalty is active", async () => {
    givenAuthenticated(true);
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-06",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });

    await redirectOwnerIfPenalised();

    expect(navigationModule.redirect).toHaveBeenCalledWith("/penalty");
  });

  it("REGRESSION: never redirects a visitor, even while a penalty is active", async () => {
    givenAuthenticated(false);
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-06",
      startedAt: 1,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 0,
    });

    await redirectOwnerIfPenalised();

    expect(navigationModule.redirect).not.toHaveBeenCalled();
  });
});
