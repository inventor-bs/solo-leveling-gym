import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { expToNextLevel } from "@/core/hunter/progression";
import { completeSession } from "./complete-session";

async function containerWithLoggedSession() {
  const db = await makeTestDb();
  await seedProgram(db);
  let n = 0;
  const container = buildContainer({
    db,
    tzOffsetMinutes: 420,
    clock: fixedClock("2026-08-05T00:00:00Z"),
    newId: () => `id-${++n}`,
  });
  await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
  await container.training.createSession({
    id: "session-1",
    day: "2026-08-05",
    programDayId: "upper-a",
    startedAt: 0,
  });
  await container.training.upsertSetLog({
    id: "set-1",
    sessionId: "session-1",
    exerciseId: "bench-press",
    setIndex: 0,
    reps: 6,
    weight: 80,
    completed: true,
    isPr: false,
    loggedAt: 0,
  });
  return container;
}

async function seedShadows(
  container: Awaited<ReturnType<typeof containerWithLoggedSession>>,
) {
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? 0 : null,
    })),
  );
}

describe("completeSession", () => {
  it("marks the session ended with a rank", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const session = await container.training.getSession("session-1");
    expect(session?.endedAt).not.toBeNull();
    expect(session?.rank).toBeTruthy();
  });

  it("awards gold and EXP matching the computed rank", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goldAwarded).toBeGreaterThan(0);
    expect(result.value.expAwarded).toBeGreaterThan(0);

    const hunter = await container.hunters.get();
    expect(hunter?.gold).toBe(result.value.goldAwarded);
  });

  it("levels up the hunter when EXP crosses the threshold", async () => {
    const container = await containerWithLoggedSession();
    // With no history, this session's rank defaults to C (dungeonRankFor
    // with avgVolume=0), which awards 350 EXP — comfortably over the
    // level-1 threshold of 100.
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.levelsGained).toBeGreaterThan(0);

    const hunter = await container.hunters.get();
    expect(hunter?.level).toBeGreaterThan(1);
  });

  it("updates hunter fatigue", async () => {
    const container = await containerWithLoggedSession();
    const before = await container.hunters.get();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const after = await container.hunters.get();
    expect(after?.fatigue ?? 0).toBeGreaterThan(before?.fatigue ?? 0);
  });

  it("returns an error for an already-completed session", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a2",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-already-completed");
  });

  it("returns an error for an unknown session", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "not-a-real-session",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("session-not-found");
  });

  it("REGRESSION: retrying the same clientActionId doesn't award gold twice", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "same-action",
    });
    const hunterAfterFirst = await container.hunters.get();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "same-action",
    });
    const hunterAfterSecond = await container.hunters.get();
    expect(hunterAfterSecond?.gold).toBe(hunterAfterFirst?.gold);
  });
});

describe("completeSession — shadow EXP", () => {
  it("adds this session's per-muscle volume to the matching shadow", async () => {
    const container = await containerWithLoggedSession();
    await seedShadows(container);

    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    const igris = await container.shadows.byId("igris");
    expect(igris?.exp).toBe(480); // 6 reps x 80kg, the fixture's only set
    expect(igris?.lastTrainedDay).toBe("2026-08-05");
  });

  it("REGRESSION: a muscle group with zero volume this session gets zero EXP and its lastTrainedDay stays untouched", async () => {
    const container = await containerWithLoggedSession();
    await seedShadows(container);

    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    const tank = await container.shadows.byId("tank"); // back — never trained this session
    expect(tank?.exp).toBe(0);
    expect(tank?.lastTrainedDay).toBeNull();
  });

  it("extracts Bellion the moment the hunter first reaches S-Rank", async () => {
    const container = await containerWithLoggedSession();
    await seedShadows(container);
    // Level 70 is the real S-Rank floor (RANK_THRESHOLDS). Push the hunter
    // to level 69 with just under the EXP this session's fixed 350-EXP C-rank
    // award needs to cross it, computed from the real threshold function so
    // this doesn't depend on a guessed magic number.
    const needed = expToNextLevel(69);
    await container.hunters.update({
      level: 69,
      exp: Math.max(0, needed - 300),
      rank: "A",
    });

    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);

    const hunter = await container.hunters.get();
    expect(hunter?.rank).toBe("S");

    const bellion = await container.shadows.byId("bellion");
    expect(bellion?.extractedAt).not.toBeNull();
    if (result.ok) {
      expect(
        result.value.events.some(
          (e) => e.type === "ShadowArisen" && e.shadowId === "bellion",
        ),
      ).toBe(true);
    }
  });

  it("does not re-extract Bellion on a later S-Rank session", async () => {
    const container = await containerWithLoggedSession();
    await seedShadows(container);
    const needed = expToNextLevel(69);
    await container.hunters.update({
      level: 69,
      exp: Math.max(0, needed - 300),
      rank: "A",
    });
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    await container.training.createSession({
      id: "session-2",
      day: "2026-08-06",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "set-2",
      sessionId: "session-2",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    const result = await completeSession(container, {
      sessionId: "session-2",
      clientActionId: "a2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.events.some(
          (e) => e.type === "ShadowArisen" && e.shadowId === "bellion",
        ),
      ).toBe(false);
    }
  });
});

describe("completeSession — title awarding", () => {
  it("earns Monarch of Dawn on the tenth session started before 07:00 local", async () => {
    const container = await containerWithLoggedSession();
    const { TITLE_CATALOG } = await import("@/core/title/catalog");
    await container.titles.seed(
      TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
    );

    // Nine morning sessions already done. 23:30 UTC is 06:30 local at UTC+7.
    const morning = Date.parse("2026-08-01T23:30:00.000Z");
    for (let i = 0; i < 9; i += 1) {
      await container.training.createSession({
        id: `dawn-${i}`,
        day: "2026-08-02",
        programDayId: "upper-a",
        startedAt: morning + i,
      });
      await container.training.completeSession(
        `dawn-${i}`,
        morning + 1000,
        "C",
      );
    }

    // The fixture's session-1 starts at epoch 0, which is 07:00 local — the
    // cutoff is exclusive, so it is not a morning session and completing it
    // would never be the tenth. Add a session before the cutoff instead.
    await container.training.createSession({
      id: "dawn-10",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: morning + 100,
    });
    const result = await completeSession(container, {
      sessionId: "dawn-10",
      clientActionId: "a1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.events.some(
          (e) => e.type === "TitleEarned" && e.titleId === "monarch-of-dawn",
        ),
      ).toBe(true);
    }
  });

  it("REGRESSION: completing a session earns nothing when the roster is unseeded", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events.some((e) => e.type === "TitleEarned")).toBe(
        false,
      );
    }
  });
});

describe("completeSession — title buffs", () => {
  async function equip(
    container: Awaited<ReturnType<typeof containerWithLoggedSession>>,
    id: string,
  ) {
    const { TITLE_CATALOG } = await import("@/core/title/catalog");
    await container.titles.seed(
      TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
    );
    await container.titles.earn(id, 1);
    await container.hunters.update({ title: id });
  }

  it("pays the base C-rank gold and EXP with nothing equipped", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.goldAwarded).toBe(70);
      expect(result.value.expAwarded).toBe(350);
    }
  });

  it("REGRESSION: Monarch of Dawn pays nothing extra on a session started after 07:00", async () => {
    const container = await containerWithLoggedSession();
    await equip(container, "monarch-of-dawn");
    // The fixture starts session-1 at epoch 0, which is 07:00 local at UTC+7
    // — the cutoff is exclusive, so this is not a morning session.
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.goldAwarded).toBe(70);
  });

  it("Monarch of Dawn pays 15% more gold on a session started before 07:00", async () => {
    const container = await containerWithLoggedSession();
    await equip(container, "monarch-of-dawn");
    await container.training.createSession({
      id: "dawn",
      day: "2026-08-05",
      programDayId: "upper-a",
      // 23:30 UTC on the 4th is 06:30 local on the 5th.
      startedAt: Date.parse("2026-08-04T23:30:00.000Z"),
    });
    await container.training.upsertSetLog({
      id: "dawn-set",
      sessionId: "dawn",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });

    const result = await completeSession(container, {
      sessionId: "dawn",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.goldAwarded).toBe(81); // round(70 * 1.15)
      expect(result.value.expAwarded).toBe(350); // EXP is untouched
    }
  });

  it("One Who Returned pays 10% more EXP on the first session after an escape", async () => {
    const container = await containerWithLoggedSession();
    await equip(container, "one-who-returned");
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-01",
      startedAt: 10,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 5,
    });
    await container.penalties.close("p1", 20);

    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.expAwarded).toBe(385); // round(350 * 1.1)
      expect(result.value.goldAwarded).toBe(70); // gold is untouched
    }
  });

  it("REGRESSION: One Who Returned pays the bonus once, not on every session afterwards", async () => {
    // "+10% EXP after exiting" is a welcome-back boost. A permanent +10%
    // would not be the small passive buff a title is supposed to be.
    const container = await containerWithLoggedSession();
    await equip(container, "one-who-returned");
    await container.penalties.create({
      id: "p1",
      startedDay: "2026-08-01",
      startedAt: 10,
      reason: "daily-quest-missed",
      variantId: 1,
      expLost: 5,
    });
    await container.penalties.close("p1", 20);
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    await container.training.createSession({
      id: "session-2",
      day: "2026-08-06",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "set-2",
      sessionId: "session-2",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    const second = await completeSession(container, {
      sessionId: "session-2",
      clientActionId: "a2",
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.expAwarded).toBe(350);
  });

  it("REGRESSION: One Who Returned pays nothing when the hunter has never been penalised", async () => {
    const container = await containerWithLoggedSession();
    await equip(container, "one-who-returned");
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.expAwarded).toBe(350);
  });
});
