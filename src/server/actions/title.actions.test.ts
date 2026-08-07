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
const { TITLE_CATALOG } = await import("@/core/title/catalog");
const { equipTitleAction } = await import("./title.actions");

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
    clock: fixedClock("2026-08-07T02:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  vi.spyOn(containerModule, "getContainer").mockReturnValue(container);
  await container.hunters.create({ name: "Jin-Woo", createdAt: 1 });
  await container.titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );
});

describe("equipTitleAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    expect(await equipTitleAction({ titleId: "unyielding" })).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("rejects a malformed payload", async () => {
    givenAuthenticated(true);
    expect(await equipTitleAction({ titleId: 42 })).toEqual({
      ok: false,
      error: "invalid-input",
    });
  });

  it("REGRESSION: reports an unearned title as data, never as a thrown error", async () => {
    // Next.js replaces a thrown message with an opaque digest in production,
    // so a throw here would reach the browser as a generic render failure.
    givenAuthenticated(true);
    expect(await equipTitleAction({ titleId: "unyielding" })).toEqual({
      ok: false,
      error: "title-not-earned",
    });
  });

  it("equips an earned title", async () => {
    givenAuthenticated(true);
    await containerModule.getContainer().titles.earn("unyielding", 100);
    expect(await equipTitleAction({ titleId: "unyielding" })).toEqual({
      ok: true,
      value: { equipped: "unyielding" },
    });
  });

  it("accepts null to unequip", async () => {
    givenAuthenticated(true);
    expect(await equipTitleAction({ titleId: null })).toEqual({
      ok: true,
      value: { equipped: null },
    });
  });
});
