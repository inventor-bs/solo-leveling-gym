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
const { fixedClock } = await import("@/infra/clock/system-clock");
const { signSession, SESSION_COOKIE } = await import("@/server/auth/session");
const { SKILL_CATALOG } = await import("@/core/skill/catalog");
const { RUNE_STONE_COST } = await import("@/core/economy/pricing");
const {
  learnSkillAction,
  equipSkillAction,
  buyRuneStoneAction,
  overrideQuestItemAction,
  swapWeeklyScheduleAction,
  depositSessionAction,
  withdrawSessionAction,
} = await import("./skill.actions");

function givenAuthenticated(authenticated: boolean) {
  cookieStore.get.mockImplementation((name: string) => {
    if (name !== SESSION_COOKIE || !authenticated) return undefined;
    return { value: signSession(Date.now() + 60_000, "s".repeat(32)) };
  });
}

beforeEach(async () => {
  cookieStore.get.mockReset();
  const db = await makeTestDb();
  const container = containerModule.buildContainer({
    db,
    clock: fixedClock("2026-08-12T00:00:00.000Z"),
    tzOffsetMinutes: 420,
  });
  vi.spyOn(containerModule, "getContainer").mockReturnValue(container);
  await container.skills.seed(SKILL_CATALOG.map((s) => ({ id: s.id })));
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  givenAuthenticated(true);
});

describe("learnSkillAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await learnSkillAction({ skillId: "tenacity" });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a malformed payload", async () => {
    const result = await learnSkillAction({ skillId: "" });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("reports unknown-skill for an id absent from the catalog", async () => {
    const result = await learnSkillAction({ skillId: "not-a-skill" });
    expect(result).toEqual({ ok: false, error: "unknown-skill" });
  });

  it("reports insufficient-ap instead of throwing", async () => {
    // Level 1 at rank E earns 0 AP; tenacity costs 3.
    const result = await learnSkillAction({ skillId: "tenacity" });
    expect(result).toEqual({ ok: false, error: "insufficient-ap" });
  });

  it("learns a skill the hunter has enough AP for", async () => {
    await containerModule
      .getContainer()
      .hunters.update({ level: 5, rank: "E" });
    const result = await learnSkillAction({ skillId: "tenacity" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.apRemaining).toBe(1);
  });
});

describe("equipSkillAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await equipSkillAction({ skillId: "tenacity", equip: true });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a malformed payload", async () => {
    const result = await equipSkillAction({
      skillId: "tenacity",
      equip: "yes",
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("reports not-learned instead of throwing", async () => {
    const result = await equipSkillAction({ skillId: "tenacity", equip: true });
    expect(result).toEqual({ ok: false, error: "not-learned" });
  });

  it("equips a learned skill", async () => {
    const container = containerModule.getContainer();
    await container.skills.learn("tenacity", container.clock.now());
    const result = await equipSkillAction({ skillId: "tenacity", equip: true });
    expect(result).toEqual({
      ok: true,
      value: { skillId: "tenacity", equipped: true },
    });
  });
});

describe("buyRuneStoneAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    expect(await buyRuneStoneAction()).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("reports insufficient-gold instead of throwing", async () => {
    expect(await buyRuneStoneAction()).toEqual({
      ok: false,
      error: "insufficient-gold",
    });
  });

  it("spends gold and returns the new slot capacity", async () => {
    await containerModule
      .getContainer()
      .hunters.update({ gold: RUNE_STONE_COST });
    const result = await buyRuneStoneAction();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.goldRemaining).toBe(0);
  });
});

describe("overrideQuestItemAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await overrideQuestItemAction({
      field: "pushups",
      value: 30,
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a field outside the Daily Quest's own targets", async () => {
    const result = await overrideQuestItemAction({
      field: "burpees",
      value: 30,
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("reports skill-not-equipped instead of throwing", async () => {
    const result = await overrideQuestItemAction({
      field: "pushups",
      value: 30,
    });
    expect(result).toEqual({ ok: false, error: "skill-not-equipped" });
  });

  it("REGRESSION: remaps the app-service's quest-not-found to quest-not-found-override, keeping it distinct from a missing-quest read elsewhere", async () => {
    // A fresh container with no hunter row at all, unlike the shared
    // beforeEach above — the override's own ensureDailyQuest call reports
    // that as "quest-not-found", which this action must not pass straight
    // through under the same key a genuinely-missing-quest read also uses.
    const db = await makeTestDb();
    const noHunterContainer = containerModule.buildContainer({
      db,
      clock: fixedClock("2026-08-12T00:00:00.000Z"),
      tzOffsetMinutes: 420,
    });
    vi.spyOn(containerModule, "getContainer").mockReturnValue(
      noHunterContainer,
    );
    await noHunterContainer.skills.seed([{ id: "rulers-authority" }]);
    await noHunterContainer.skills.equip(
      "rulers-authority",
      noHunterContainer.clock.now(),
    );
    const result = await overrideQuestItemAction({
      field: "pushups",
      value: 30,
    });
    expect(result).toEqual({ ok: false, error: "quest-not-found-override" });
  });

  it("overrides today's target once rulers-authority is equipped", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("rulers-authority", container.clock.now());
    const result = await overrideQuestItemAction({
      field: "pushups",
      value: 30,
    });
    expect(result).toEqual({
      ok: true,
      value: { field: "pushups", newValue: 30 },
    });
  });

  it("reports already-overridden-today on a second call the same day", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("rulers-authority", container.clock.now());
    await overrideQuestItemAction({ field: "pushups", value: 30 });
    const second = await overrideQuestItemAction({
      field: "situps",
      value: 30,
    });
    expect(second).toEqual({ ok: false, error: "already-overridden-today" });
  });
});

describe("swapWeeklyScheduleAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    const result = await swapWeeklyScheduleAction({
      weekdayFrom: 1,
      weekdayTo: 2,
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a weekday outside 1-7", async () => {
    const result = await swapWeeklyScheduleAction({
      weekdayFrom: 0,
      weekdayTo: 2,
    });
    expect(result).toEqual({ ok: false, error: "invalid-input" });
  });

  it("reports skill-not-equipped instead of throwing", async () => {
    const result = await swapWeeklyScheduleAction({
      weekdayFrom: 1,
      weekdayTo: 2,
    });
    expect(result).toEqual({ ok: false, error: "skill-not-equipped" });
  });

  it("swaps once shadow-exchange is equipped", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("shadow-exchange", container.clock.now());
    const result = await swapWeeklyScheduleAction({
      weekdayFrom: 1,
      weekdayTo: 2,
    });
    expect(result.ok).toBe(true);
  });
});

describe("depositSessionAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    expect(await depositSessionAction()).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("reports skill-not-equipped instead of throwing", async () => {
    expect(await depositSessionAction()).toEqual({
      ok: false,
      error: "skill-not-equipped",
    });
  });

  it("reports no-session-to-deposit instead of throwing", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("shadow-storage", container.clock.now());
    expect(await depositSessionAction()).toEqual({
      ok: false,
      error: "no-session-to-deposit",
    });
  });
});

describe("withdrawSessionAction", () => {
  it("reports unauthorized instead of throwing", async () => {
    givenAuthenticated(false);
    expect(await withdrawSessionAction()).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("reports skill-not-equipped instead of throwing", async () => {
    expect(await withdrawSessionAction()).toEqual({
      ok: false,
      error: "skill-not-equipped",
    });
  });

  it("reports no-banked-sessions instead of throwing", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("shadow-storage", container.clock.now());
    expect(await withdrawSessionAction()).toEqual({
      ok: false,
      error: "no-banked-sessions",
    });
  });

  it("withdraws a banked session into a pending credit", async () => {
    const container = containerModule.getContainer();
    await container.skills.equip("shadow-storage", container.clock.now());
    await container.skills.deposit("session-1", container.clock.now());
    const result = await withdrawSessionAction();
    expect(result).toEqual({ ok: true, value: { pendingCredits: 1 } });
  });
});
