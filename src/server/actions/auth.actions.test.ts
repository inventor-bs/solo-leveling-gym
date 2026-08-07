import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "s".repeat(32), HUNTER_PIN: "7391" }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const containerModule = await import("@/server/container");
const { makeTestDb } = await import("@/infra/db/testing/make-test-db");
const { loginAction } = await import("./auth.actions");
const { SESSION_COOKIE } = await import("@/server/auth/session");
const navigationModule = await import("next/navigation");

let container: ReturnType<typeof containerModule.buildContainer>;

beforeEach(async () => {
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  vi.mocked(navigationModule.redirect).mockClear();
  const db = await makeTestDb();
  container = containerModule.buildContainer({ db, tzOffsetMinutes: 420 });
  vi.spyOn(containerModule, "getContainer").mockReturnValue(container);
});

function formDataWithPin(pin: string): FormData {
  const fd = new FormData();
  fd.set("pin", pin);
  return fd;
}

describe("loginAction", () => {
  it("sets a session cookie on a correct PIN", async () => {
    await loginAction(formDataWithPin("7391"));
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("redirects server-side to /onboarding when no hunter exists yet — the client never has to guess", async () => {
    await loginAction(formDataWithPin("7391"));
    expect(navigationModule.redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("REGRESSION: redirects server-side to /dashboard when a hunter is already onboarded", async () => {
    await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
    await loginAction(formDataWithPin("7391"));
    expect(navigationModule.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("does not set a cookie on an incorrect PIN", async () => {
    const result = await loginAction(formDataWithPin("0000"));
    expect(result.ok).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("does not redirect on an incorrect PIN", async () => {
    await loginAction(formDataWithPin("0000"));
    expect(navigationModule.redirect).not.toHaveBeenCalled();
  });

  it("rejects a missing pin field without throwing", async () => {
    const result = await loginAction(new FormData());
    expect(result.ok).toBe(false);
    expect(navigationModule.redirect).not.toHaveBeenCalled();
  });
});
