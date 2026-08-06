import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));
vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "s".repeat(32), HUNTER_PIN: "7391" }),
}));

const { loginAction } = await import("./auth.actions");
const { SESSION_COOKIE } = await import("@/server/auth/session");

beforeEach(() => {
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
});

function formDataWithPin(pin: string): FormData {
  const fd = new FormData();
  fd.set("pin", pin);
  return fd;
}

describe("loginAction", () => {
  it("sets a session cookie on a correct PIN", async () => {
    const result = await loginAction(formDataWithPin("7391"));
    expect(result.ok).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("does not set a cookie on an incorrect PIN", async () => {
    const result = await loginAction(formDataWithPin("0000"));
    expect(result.ok).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects a missing pin field without throwing", async () => {
    const result = await loginAction(new FormData());
    expect(result.ok).toBe(false);
  });
});
