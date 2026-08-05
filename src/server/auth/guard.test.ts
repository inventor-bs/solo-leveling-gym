import { describe, it, expect, vi, beforeEach } from "vitest";

const SECRET = "s".repeat(32);

// next/headers is only available inside a request scope, so the cookie store
// is stubbed. getEnv is stubbed too, to keep the test off process.env.
const cookieStore = { get: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: SECRET }),
}));

const { requireWriteAccess, hasWriteAccess, UnauthorizedError } =
  await import("./guard");
const { signSession, SESSION_COOKIE } = await import("./session");

function givenCookie(value: string | undefined) {
  cookieStore.get.mockImplementation((name: string) =>
    name === SESSION_COOKIE && value !== undefined ? { value } : undefined,
  );
}

beforeEach(() => {
  cookieStore.get.mockReset();
});

describe("requireWriteAccess", () => {
  it("passes with a valid, unexpired session cookie", async () => {
    givenCookie(signSession(Date.now() + 60_000, SECRET));
    await expect(requireWriteAccess()).resolves.toBeUndefined();
  });

  it("throws when no cookie is present", async () => {
    givenCookie(undefined);
    await expect(requireWriteAccess()).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the cookie is expired", async () => {
    givenCookie(signSession(Date.now() - 1, SECRET));
    await expect(requireWriteAccess()).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the cookie was signed with a different secret", async () => {
    givenCookie(signSession(Date.now() + 60_000, "x".repeat(32)));
    await expect(requireWriteAccess()).rejects.toThrow(UnauthorizedError);
  });

  it("throws on a malformed cookie value", async () => {
    givenCookie("garbage");
    await expect(requireWriteAccess()).rejects.toThrow(UnauthorizedError);
  });
});

describe("hasWriteAccess", () => {
  it("returns true for a valid session", async () => {
    givenCookie(signSession(Date.now() + 60_000, SECRET));
    expect(await hasWriteAccess()).toBe(true);
  });

  it("returns false instead of throwing when unauthenticated", async () => {
    givenCookie(undefined);
    expect(await hasWriteAccess()).toBe(false);
  });

  it("returns false for a tampered cookie without throwing", async () => {
    givenCookie("garbage");
    expect(await hasWriteAccess()).toBe(false);
  });
});
