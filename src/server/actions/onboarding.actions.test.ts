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
const { completeOnboardingAction } = await import("./onboarding.actions");

function givenAuthenticated(authenticated: boolean) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name !== SESSION_COOKIE || !authenticated) return undefined;
    return { value: signSession(Date.now() + 60_000, "s".repeat(32)) };
  });
}

beforeEach(async () => {
  cookieStore.get.mockReset();
  const db = await makeTestDb();
  vi.spyOn(containerModule, "getContainer").mockReturnValue(
    containerModule.buildContainer({ db, tzOffsetMinutes: 420 }),
  );
});

describe("completeOnboardingAction", () => {
  it("rejects when unauthenticated", async () => {
    givenAuthenticated(false);
    const result = await completeOnboardingAction({
      name: "Jin-Woo",
      reasonForHunting: "For my family.",
    });
    expect(result.ok).toBe(false);
  });

  it("creates the hunter with the given name and reason", async () => {
    givenAuthenticated(true);
    const result = await completeOnboardingAction({
      name: "Jin-Woo",
      reasonForHunting: "For my family.",
    });
    expect(result.ok).toBe(true);

    const hunter = await containerModule.getContainer().hunters.get();
    expect(hunter?.name).toBe("Jin-Woo");
    expect(hunter?.reasonForHunting).toBe("For my family.");
    expect(hunter?.level).toBe(1);
  });

  it("rejects an empty name", async () => {
    givenAuthenticated(true);
    const result = await completeOnboardingAction({
      name: "",
      reasonForHunting: "For my family.",
    });
    expect(result.ok).toBe(false);
  });

  it("REGRESSION: rejects onboarding a second time once a hunter exists", async () => {
    givenAuthenticated(true);
    await completeOnboardingAction({
      name: "Jin-Woo",
      reasonForHunting: "First.",
    });
    const second = await completeOnboardingAction({
      name: "Someone Else",
      reasonForHunting: "Second.",
    });
    expect(second.ok).toBe(false);

    const hunter = await containerModule.getContainer().hunters.get();
    expect(hunter?.name).toBe("Jin-Woo");
  });

  it("REGRESSION: seeds all nine shadows, with only Igris extracted", async () => {
    givenAuthenticated(true);
    await completeOnboardingAction({
      name: "Jin-Woo",
      reasonForHunting: "For my family.",
    });

    const rows = await containerModule.getContainer().shadows.all();
    expect(rows).toHaveLength(9);

    const igris = rows.find((s) => s.id === "igris");
    expect(igris?.extractedAt).not.toBeNull();

    const others = rows.filter((s) => s.id !== "igris");
    expect(others.every((s) => s.extractedAt === null)).toBe(true);
  });

  it("seeds every title, all of them unearned", async () => {
    givenAuthenticated(true);
    await completeOnboardingAction({
      name: "Jin-Woo",
      reasonForHunting: "For my family.",
    });

    const rows = await containerModule.getContainer().titles.all();
    expect(rows).toHaveLength(3);
    expect(rows.every((t) => t.earnedAt === null)).toBe(true);
    expect(rows.map((t) => t.id).sort()).toEqual([
      "monarch-of-dawn",
      "one-who-returned",
      "unyielding",
    ]);
  });
});
