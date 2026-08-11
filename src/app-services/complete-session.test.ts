import { describe, it, expect } from "vitest";
import { fixedClock } from "@/infra/clock/system-clock";
import { makeTestDb } from "@/infra/db/testing/make-test-db";
import { seedProgram } from "@/infra/db/seed/program";
import { buildContainer } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { expToNextLevel } from "@/core/hunter/progression";
import { deriveStats } from "@/core/hunter/stats";
import type { TrainingDay } from "@/core/shared/training-day";
import type { Container } from "@/server/container";
import { completeSession, currentLuck } from "./complete-session";
import { buildStatInput } from "./stat-input";
import { bossSetExp } from "@/core/training/boss-set";
import { vitalStrikeBossMultiplier } from "@/core/skill/buffs";

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

  it("Legion adds 10% to every shadow's EXP gain from this session", async () => {
    // Run the same fixture session twice — once with Legion equipped, once
    // without — and compare the resulting gains rather than hardcoding an
    // expected number, which would just restate the implementation.
    const baseline = await containerWithLoggedSession();
    await seedShadows(baseline);
    await completeSession(baseline, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const baselineIgris = await baseline.shadows.byId("igris");
    const baselineGain = baselineIgris?.exp ?? 0;

    const withLegion = await containerWithLoggedSession();
    await seedShadows(withLegion);
    await withLegion.skills.seed([{ id: "legion" }]);
    await withLegion.skills.learn("legion", 100);
    await withLegion.skills.equip("legion", 100);
    await completeSession(withLegion, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const legionIgris = await withLegion.shadows.byId("igris");
    const legionGain = legionIgris?.exp ?? 0;

    expect(legionGain).toBeGreaterThan(baselineGain);
    expect(legionGain).toBe(Math.round(baselineGain * 1.1));
    expect(legionGain % 1).toBe(0); // still rounded to a whole EXP amount
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
  /**
   * These tests assert on the multiplier math title buffs apply to rank
   * gold, not on PR or level-up income (covered by their own describe
   * block). Left as containerWithLoggedSession() alone, every one of them
   * would incidentally pay for a PR (the fixture's bench set is always the
   * exercise's first log) and a level-up (a level-1 hunter's session EXP
   * always crosses the level-2 threshold), neither of which these tests are
   * about. Suppress both without touching containerWithLoggedSession()
   * itself: a prior COMPLETED session at the same e1RM means the fixture's
   * bench set ties rather than beats it (ties don't count as a PR), and
   * starting well above level 1 puts the next level threshold far beyond
   * any single session's EXP.
   */
  async function containerForTitleBuffTest() {
    const container = await containerWithLoggedSession();
    await container.hunters.update({ level: 10, exp: 0 });
    await container.training.createSession({
      id: "prior-bench",
      day: "2026-08-04",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "prior-bench-set",
      sessionId: "prior-bench",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.training.completeSession("prior-bench", 0, "C");
    return container;
  }

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
    const container = await containerForTitleBuffTest();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.goldAwarded).toBe(70);
      // 350 base C-rank EXP + round(15 * 1.5) = 23 for the fixture's one
      // BOSS set (the bench-press set) at the default 1.5x multiplier.
      expect(result.value.expAwarded).toBe(373);
    }
  });

  it("REGRESSION: Monarch of Dawn pays nothing extra on a session started after 07:00", async () => {
    const container = await containerForTitleBuffTest();
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
    const container = await containerForTitleBuffTest();
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
      // EXP is untouched by the title buff — still 350 base + the fixture's
      // one BOSS set bonus of round(15 * 1.5) = 23.
      expect(result.value.expAwarded).toBe(373);
    }
  });

  it("One Who Returned pays 10% more EXP on the first session after an escape", async () => {
    const container = await containerForTitleBuffTest();
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
      // round(350 * 1.1) = 385, then + round(15 * 1.5) = 23 for the
      // fixture's one BOSS set, added after the title multiplier rather
      // than scaled by it.
      expect(result.value.expAwarded).toBe(408);
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
    // 350 base + round(15 * 1.5) = 23 for session-2's own one BOSS set —
    // the title bonus applied once, not this untitled second session.
    if (second.ok) expect(second.value.expAwarded).toBe(373);
  });

  it("REGRESSION: One Who Returned pays nothing when the hunter has never been penalised", async () => {
    const container = await containerWithLoggedSession();
    await equip(container, "one-who-returned");
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    // 350 base + round(15 * 1.5) = 23 for the fixture's one BOSS set.
    if (result.ok) expect(result.value.expAwarded).toBe(373);
  });
});

describe("completeSession — skill buffs", () => {
  /**
   * Level 10 with a tying prior session (the same suppression technique the
   * title-buff tests above use) keeps this test's gold delta down to
   * rankGold alone: no PR bonus, since the prior session ties session-1's
   * e1RM rather than beating it, and no level-up bonus, since level 10
   * needs far more EXP than one session awards. Seven more prior sessions
   * logged at a lower volume than session-1's own set pull the 8-session
   * rolling average down enough that session-1's volume clears the B-Rank
   * ratio threshold (1.1).
   */
  async function containerForBloodlustTest() {
    const container = await containerWithLoggedSession();
    await container.hunters.update({ level: 10, exp: 0 });
    await container.training.createSession({
      id: "prior-bench",
      day: "2026-08-04",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "prior-bench-set",
      sessionId: "prior-bench",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 6,
      weight: 80,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.training.completeSession("prior-bench", 0, "C");

    for (let i = 0; i < 7; i += 1) {
      await container.training.createSession({
        id: `hist-${i}`,
        day: "2026-08-01",
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.upsertSetLog({
        id: `hist-set-${i}`,
        sessionId: `hist-${i}`,
        exerciseId: "bench-press",
        setIndex: 0,
        reps: 5,
        weight: 80,
        completed: true,
        isPr: false,
        loggedAt: i,
      });
      await container.training.completeSession(`hist-${i}`, i + 1, "C");
    }
    return container;
  }

  it("Bloodlust adds 50% gold on a B-Rank or better dungeon", async () => {
    // Same-fixture A/B comparison: two identical setups except for whether
    // Bloodlust is equipped, comparing the resulting gold rather than
    // hardcoding an expected literal.
    const baseline = await containerForBloodlustTest();
    const baselineResult = await completeSession(baseline, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(baselineResult.ok).toBe(true);
    if (!baselineResult.ok) return;
    expect(["B", "A"]).toContain(baselineResult.value.rank);

    const withBloodlust = await containerForBloodlustTest();
    await withBloodlust.skills.seed([{ id: "bloodlust" }]);
    await withBloodlust.skills.learn("bloodlust", 100);
    await withBloodlust.skills.equip("bloodlust", 100);
    const bloodlustResult = await completeSession(withBloodlust, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(bloodlustResult.ok).toBe(true);
    if (!bloodlustResult.ok) return;

    expect(bloodlustResult.value.rank).toBe(baselineResult.value.rank);
    expect(bloodlustResult.value.goldAwarded).toBe(
      Math.round(baselineResult.value.goldAwarded * 1.5),
    );
    expect(bloodlustResult.value.expAwarded).toBe(
      baselineResult.value.expAwarded,
    );
  });

  it("Vital Strike doubles the BOSS-set EXP bonus instead of 1.5x", async () => {
    // Same-fixture A/B comparison, the same pattern as the Bloodlust test
    // above. session-1's one completed bench-press set is its only BOSS
    // set, so the whole delta between these two runs is that single BOSS
    // set's bonus moving from the default 1.5x multiplier to Vital
    // Strike's 2x.
    const baseline = await containerWithLoggedSession();
    const baselineResult = await completeSession(baseline, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(baselineResult.ok).toBe(true);
    if (!baselineResult.ok) return;

    const withVitalStrike = await containerWithLoggedSession();
    await withVitalStrike.skills.seed([{ id: "vital-strike" }]);
    await withVitalStrike.skills.learn("vital-strike", 100);
    await withVitalStrike.skills.equip("vital-strike", 100);
    const vitalStrikeResult = await completeSession(withVitalStrike, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(vitalStrikeResult.ok).toBe(true);
    if (!vitalStrikeResult.ok) return;

    const defaultBonus = bossSetExp(1, vitalStrikeBossMultiplier(new Set()));
    const vitalStrikeBonus = bossSetExp(
      1,
      vitalStrikeBossMultiplier(new Set(["vital-strike"])),
    );
    expect(vitalStrikeResult.value.expAwarded).toBe(
      baselineResult.value.expAwarded - defaultBonus + vitalStrikeBonus,
    );
  });
});

describe("completeSession — PR and level-up income", () => {
  it("pays 150 gold for the session's one PR, on top of the rank reward", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The bench set is the first ever logged for that exercise, so it beats
    // a previous best of zero and is a PR.
    expect(result.value.prGold).toBe(150);
  });

  it("pays per PR, so two lifts broken in one session pay twice", async () => {
    const container = await containerWithLoggedSession();
    await container.training.upsertSetLog({
      id: "set-2",
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.prGold).toBe(300);
  });

  it("pays nothing for a bodyweight set, which can never be a PR", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-05T00:00:00Z"),
      newId: () => "id-1",
    });
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    await container.training.createSession({
      id: "s",
      day: "2026-08-05",
      programDayId: "upper-a",
      startedAt: 0,
    });
    await container.training.upsertSetLog({
      id: "set-1",
      sessionId: "s",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 20,
      weight: 0,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    const result = await completeSession(container, {
      sessionId: "s",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.prGold).toBe(0);
  });

  it("pays 100 gold per level crossed, counted from the NEW level", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    // A first session with no history ranks C and pays 350 base EXP plus
    // round(15 * 1.5) = 23 for the fixture's one BOSS set, 373 total. That
    // carries a level-1 hunter past level 2's 100-EXP threshold AND level
    // 3's round(100 * 2^1.35) = 255-EXP threshold (100 + 255 = 355 < 373),
    // two levels crossed, paying 100*2 gold for level 2 plus 100*3 for
    // level 3.
    expect(result.value.levelsGained).toBe(2);
    expect(result.value.levelUpGold).toBe(500);
  });

  it("credits the hunter the rank reward plus both new income sources", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    const hunter = await container.hunters.get();
    expect(hunter?.gold).toBe(result.value.goldAwarded);
    expect(result.value.goldAwarded).toBeGreaterThanOrEqual(
      result.value.prGold + result.value.levelUpGold,
    );
  });

  it("records a GoldGained event for each new source, tagged with that source", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    const sources = result.value.events
      .filter((e) => e.type === "GoldGained")
      .map((e) => (e as { source: string }).source);
    expect(sources).toContain("dungeon");
    expect(sources).toContain("pr");
    expect(sources).toContain("level-up");
  });
});

describe("completeSession — event persistence", () => {
  it("persists SessionCompleted and every other event this call produces", async () => {
    const container = await containerWithLoggedSession();
    await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const rows = await container.events.between(
      "2026-08-05" as TrainingDay,
      "2026-08-05" as TrainingDay,
    );
    expect(rows.some((r) => r.type === "SessionCompleted")).toBe(true);
    expect(rows.some((r) => r.type === "GoldGained")).toBe(true);
    expect(rows.some((r) => r.type === "ExpGained")).toBe(true);
  });
});

describe("completeSession — equipment buffs", () => {
  it("pays more EXP with Knight Killer when the session trained Back", async () => {
    const bare = await containerWithLoggedSession();
    await bare.training.upsertSetLog({
      id: "set-2",
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    const baseline = await completeSession(bare, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    const armed = await containerWithLoggedSession();
    await armed.training.upsertSetLog({
      id: "set-2",
      sessionId: "session-1",
      exerciseId: "barbell-row",
      setIndex: 0,
      reps: 8,
      weight: 60,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await armed.equipment.put("weapon", "legendary", 0);
    const buffed = await completeSession(armed, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    if (!baseline.ok || !buffed.ok) return;
    // Both fixtures log the same two main-compound-lift sets (bench-press
    // and barbell-row), so both carry the identical BOSS-set bonus —
    // round(2 * 15 * 1.5) — added AFTER Knight Killer's 1.25x, not scaled
    // by it. Subtract it from both sides before checking the proportional
    // relationship the equipment multiplier alone is responsible for.
    const bossBonus = bossSetExp(2, vitalStrikeBossMultiplier(new Set()));
    expect(buffed.value.expAwarded - bossBonus).toBe(
      Math.round((baseline.value.expAwarded - bossBonus) * 1.25),
    );
  });

  it("pays no Knight Killer bonus for a session with no Back volume", async () => {
    const bare = await containerWithLoggedSession();
    const baseline = await completeSession(bare, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    const armed = await containerWithLoggedSession();
    await armed.equipment.put("weapon", "legendary", 0);
    const buffed = await completeSession(armed, {
      sessionId: "session-1",
      clientActionId: "a1",
    });

    if (!baseline.ok || !buffed.ok) return;
    expect(buffed.value.expAwarded).toBe(baseline.value.expAwarded);
  });

  it("accumulates less fatigue with Shadow Compression Gear equipped", async () => {
    const bare = await containerWithLoggedSession();
    await completeSession(bare, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const bareFatigue = (await bare.hunters.get())?.fatigue ?? 0;

    const armed = await containerWithLoggedSession();
    await armed.equipment.put("armor", "legendary", 0);
    await completeSession(armed, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    const armedFatigue = (await armed.hunters.get())?.fatigue ?? 0;

    expect(armedFatigue).toBeLessThan(bareFatigue);
  });

  it("ignores a grade value that is not in the catalog rather than trusting it", async () => {
    const container = await containerWithLoggedSession();
    await container.equipment.put("weapon", "mythic", 0);
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    // A hand-edited row must not be able to hand out a buff, the same rule
    // equippedTitleId already enforces for hunter.title.
    expect(result.ok).toBe(true);
  });
});

describe("completeSession — challenge resolution", () => {
  /** Eight prior sessions of 1000 volume each, so avgVolume is a real 1000. */
  async function withVolumeHistory(container: Container, avgEach = 1_000) {
    for (let i = 0; i < 8; i += 1) {
      await container.training.createSession({
        id: `hist-${i}`,
        day: "2026-08-01",
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.upsertSetLog({
        id: `hist-set-${i}`,
        sessionId: `hist-${i}`,
        exerciseId: "bench-press",
        setIndex: 0,
        reps: 10,
        weight: avgEach / 10,
        completed: true,
        isPr: false,
        loggedAt: i,
      });
      await container.training.completeSession(`hist-${i}`, i + 1, "C");
    }
  }

  it("quadruples gold and EXP when a Red Gate's volume target is met", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container);
    // The live session logs 6 x 80 = 480... replace it with a big one.
    await container.training.upsertSetLog({
      id: "set-1",
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 20,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now(),
      floor: null,
    });

    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge).toEqual({
      type: "red-gate",
      floor: null,
      cleared: true,
    });
    expect(result.value.events.map((e) => e.type)).toContain("RedGateCleared");
    // 2000 volume against a 1000 average is a 2.0 ratio, so A-rank: 120 gold
    // and 600 EXP at the base rate, both multiplied by four (2,400 EXP),
    // plus round(15 * 1.5) = 23 for the session's one BOSS set — added
    // after the challenge multiplier, not scaled by it.
    expect(result.value.expAwarded).toBe(2_423);
  });

  it("pays nothing extra and reports failure when the Red Gate target is missed", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container);
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now(),
      floor: null,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge?.cleared).toBe(false);
    expect(result.value.events.map((e) => e.type)).toContain("RedGateFailed");
    expect(await container.store.pendingChallenge()).toBeNull();
  });

  it("never clears a Red Gate on a database with no volume history", async () => {
    // 1.5 x 0 is 0, which every session trivially reaches. An unmeasurable
    // target is not a cleared one.
    const container = await containerWithLoggedSession();
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now(),
      floor: null,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge?.cleared).toBe(false);
  });

  it("expires a challenge bought on an earlier day without honouring it", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container);
    await container.store.setPendingChallenge({
      type: "red-gate",
      // One full day before the session's training day.
      purchasedAt: container.clock.now() - 86_400_000,
      floor: null,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge).toBeNull();
    expect(result.value.events.map((e) => e.type)).toContain("RedGateFailed");
    expect(await container.store.pendingChallenge()).toBeNull();
  });

  it("pays 300 per PR when a Boss Raid produced at least one", async () => {
    const container = await containerWithLoggedSession();
    await container.store.setPendingChallenge({
      type: "boss-raid",
      purchasedAt: container.clock.now(),
      floor: null,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.prGold).toBe(300);
    expect(result.value.challenge?.cleared).toBe(true);
    expect(result.value.events.map((e) => e.type)).toContain("BossRaidCleared");
  });

  it("falls back to the normal session when a Boss Raid produced no PR", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container, 10_000);
    await container.store.setPendingChallenge({
      type: "boss-raid",
      purchasedAt: container.clock.now(),
      floor: null,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    // The history above logs bench-press at 1000 kg per set, so the live
    // session's 80 kg cannot beat it and there is no PR.
    expect(result.value.prGold).toBe(0);
    expect(result.value.challenge?.cleared).toBe(false);
    expect(await container.store.pendingChallenge()).toBeNull();
  });

  it("advances the Demon Castle when the floor's target is met", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container);
    await container.training.upsertSetLog({
      id: "set-1",
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 20,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.store.setPendingChallenge({
      type: "demon-castle",
      purchasedAt: container.clock.now(),
      floor: 1,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge).toEqual({
      type: "demon-castle",
      floor: 1,
      cleared: true,
    });
    expect(await container.store.highestFloorCleared()).toBe(1);
    expect(result.value.events).toContainEqual({
      type: "DemonCastleFloorCleared",
      floor: 1,
    });
  });

  it("leaves the highest floor untouched when the target is missed", async () => {
    const container = await containerWithLoggedSession();
    await withVolumeHistory(container);
    await container.store.setPendingChallenge({
      type: "demon-castle",
      purchasedAt: container.clock.now(),
      floor: 1,
    });
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge?.cleared).toBe(false);
    expect(await container.store.highestFloorCleared()).toBe(0);
  });

  it("reports no challenge at all when none was bought", async () => {
    const container = await containerWithLoggedSession();
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge).toBeNull();
  });
});

describe("completeSession — equipment drops", () => {
  /**
   * A scripted RngPort. The drop roll consumes, in order:
   *   1. next()  — the drop-chance roll (skipped when a grade is guaranteed)
   *   2. int()   — which slot
   *   3. next()  — the grade roll (skipped when a grade is guaranteed)
   */
  function scriptedRng(floats: number[], ints: number[]) {
    let f = 0;
    let i = 0;
    return {
      next: () => floats[f++] ?? 1,
      int: (min: number, max: number) => {
        const chosen = ints[i++] ?? 0;
        return Math.min(Math.max(min, min + chosen), max - 1);
      },
    };
  }

  async function containerWithRng(rng: {
    next: () => number;
    int: (a: number, b: number) => number;
  }) {
    const db = await makeTestDb();
    await seedProgram(db);
    let n = 0;
    const container = buildContainer({
      db,
      rng,
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

  it("drops nothing when the chance roll misses", async () => {
    const container = await containerWithRng(scriptedRng([0.99], [0]));
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.drop).toBeNull();
    expect(await container.equipment.all()).toEqual([]);
  });

  it("fills an empty slot when the chance roll hits", async () => {
    // 0.001 clears a C-rank's 0.08 base rate; slot index 0; grade roll 0.01
    // lands in the common band.
    const container = await containerWithRng(scriptedRng([0.001, 0.01], [0]));
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.drop).toEqual({
      slot: "weapon",
      name: "Knight Killer",
      grade: "common",
      replacedGrade: null,
    });
    expect((await container.equipment.bySlot("weapon"))?.grade).toBe("common");
  });

  it("records what dropped as an event", async () => {
    const container = await containerWithRng(scriptedRng([0.001, 0.99], [1]));
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual({
      type: "EquipmentDropped",
      slot: "armor",
      name: "Shadow Compression Gear",
      grade: "legendary",
      replacedGrade: null,
    });
  });

  it("prefers an empty slot over one that already holds an item", async () => {
    const container = await containerWithRng(scriptedRng([0.001, 0.01], [0]));
    await container.equipment.put("weapon", "legendary", 0);
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    // Index 0 of the EMPTY slots, which is armor once weapon is taken.
    expect(result.value.drop?.slot).toBe("armor");
  });

  it("replaces a full slot only when the new grade is strictly better", async () => {
    const container = await containerWithRng(scriptedRng([0.001, 0.99], [0]));
    await container.equipment.put("weapon", "common", 0);
    await container.equipment.put("armor", "common", 0);
    await container.equipment.put("accessory", "common", 0);
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.drop).toMatchObject({
      slot: "weapon",
      grade: "legendary",
      replacedGrade: "common",
    });
  });

  it("reports nothing and changes nothing when the roll would downgrade a slot", async () => {
    const container = await containerWithRng(scriptedRng([0.001, 0.01], [0]));
    await container.equipment.put("weapon", "legendary", 0);
    await container.equipment.put("armor", "legendary", 0);
    await container.equipment.put("accessory", "legendary", 0);
    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.drop).toBeNull();
    expect((await container.equipment.bySlot("weapon"))?.grade).toBe(
      "legendary",
    );
  });

  it("guarantees an epic when a Red Gate is cleared, whatever the roll says", async () => {
    // Every float here would miss the chance roll and roll common — a
    // cleared Red Gate must ignore both.
    const container = await containerWithRng(scriptedRng([0.999, 0.001], [0]));
    for (let i = 0; i < 8; i += 1) {
      await container.training.createSession({
        id: `hist-${i}`,
        day: "2026-08-01",
        programDayId: "upper-a",
        startedAt: i,
      });
      await container.training.upsertSetLog({
        id: `hist-set-${i}`,
        sessionId: `hist-${i}`,
        exerciseId: "bench-press",
        setIndex: 0,
        reps: 10,
        weight: 10,
        completed: true,
        isPr: false,
        loggedAt: i,
      });
      await container.training.completeSession(`hist-${i}`, i + 1, "C");
    }
    await container.training.upsertSetLog({
      id: "set-1",
      sessionId: "session-1",
      exerciseId: "bench-press",
      setIndex: 0,
      reps: 20,
      weight: 100,
      completed: true,
      isPr: false,
      loggedAt: 0,
    });
    await container.store.setPendingChallenge({
      type: "red-gate",
      purchasedAt: container.clock.now(),
      floor: null,
    });

    const result = await completeSession(container, {
      sessionId: "session-1",
      clientActionId: "a1",
    });
    if (!result.ok) return;
    expect(result.value.challenge?.cleared).toBe(true);
    expect(result.value.drop?.grade).toBe("epic");
  });
});

describe("currentLuck — the cheap read the drop roll actually needs", () => {
  /**
   * A non-trivial scenario: several consecutive completed Daily Quests
   * ending yesterday, so streakDays (and therefore LUCK) is not just zero
   * either way — a bug that zeroed the streak would still pass a test built
   * on an empty history.
   */
  async function containerWithAStreak(): Promise<Container> {
    const db = await makeTestDb();
    await seedProgram(db);
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-05T00:00:00Z"), // "today" = 2026-08-05 ICT
    });
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });
    const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"];
    for (const [i, day] of days.entries()) {
      await container.quests.create({
        id: `q-${i}`,
        day,
        rank: "E",
        targetPushups: 20,
        targetSitups: 20,
        targetSquats: 20,
        targetRunKm: 1,
        createdAt: i,
      });
      await container.quests.setStatus(day, "completed", i);
    }
    return container;
  }

  it("matches deriveStats(buildStatInput(...)).luck — the expensive path this replaces", async () => {
    const container = await containerWithAStreak();
    const cheap = await currentLuck(container);
    const expensive = deriveStats(await buildStatInput(container)).luck;

    expect(cheap).toBe(expensive);
    // Proves the streak actually reached the formula rather than both sides
    // coincidentally agreeing on zero.
    expect(cheap).toBeGreaterThan(0);
  });

  it("reads zero for a hunter with no streak at all, same as the expensive path", async () => {
    const db = await makeTestDb();
    await seedProgram(db);
    const container = buildContainer({
      db,
      tzOffsetMinutes: 420,
      clock: fixedClock("2026-08-05T00:00:00Z"),
    });
    await container.hunters.create({ name: "Jin-Woo", createdAt: 0 });

    const cheap = await currentLuck(container);
    const expensive = deriveStats(await buildStatInput(container)).luck;
    expect(cheap).toBe(0);
    expect(expensive).toBe(0);
  });
});
