import { describe, it, expect } from "vitest";
import type { RngPort } from "@/ports/rng.port";
import {
  buildSystemMessage,
  type SystemContext,
  COLD_COPY,
  MOCKING_COPY,
  ANCIENT_COPY,
  MERCILESS_COPY,
  VOICE_BRANCHES,
  type ToneCopy,
} from "./template-engine";
import { VOICE_POOL_KINDS } from "./types";

/**
 * A tiny local RngPort fake — deliberately NOT `@/infra/rng/seeded-rng`.
 * core/'s tests must not depend on infra/, even for a test double;
 * ESLint's `import/no-restricted-paths` zone rule enforces this for
 * every file under core/, tests included, and catches it if violated.
 */
function fakeRng(seed: number): RngPort {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    // A simple LCG. Not cryptographic, not mulberry32 — just deterministic.
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  return {
    next,
    int: (minInclusive: number, maxExclusive: number): number =>
      minInclusive + Math.floor(next() * (maxExclusive - minInclusive)),
  };
}

function baseContext(patch: Partial<SystemContext> = {}): SystemContext {
  return {
    hunterName: "Jin-Woo",
    level: 2,
    rank: "E",
    title: null,
    className: null,
    streakDays: 0,
    fatigue: 0,
    reasonForHunting: null,
    todayProgramName: "Upper A",
    todayMainLift: "Bench Press",
    isRestDay: false,
    // Defaults to true so pre-existing tests that don't care about the
    // quest-pending branch still exercise the program/rest/run branches
    // below it — only tests that explicitly set this to false test that
    // branch's priority.
    dailyQuestDone: true,
    sessionsLast7d: 0,
    missedDays30d: 0,
    penaltyCount30d: 0,
    liftsUp: [],
    liftsDown: [],
    recentPr: null,
    penaltyActive: false,
    penaltySilent: false,
    weakestShadow: null,
    armyRank: null,
    arcStage: "dormant",
    unlockedFragments: [],
    lastMessages: [],
    ...patch,
  };
}

describe("buildSystemMessage", () => {
  it("always addresses the hunter as 'Hunter', never by name, per the voice rules", () => {
    const msg = buildSystemMessage(baseContext(), fakeRng(1));
    expect(msg.body).toMatch(/Hunter/);
    expect(msg.body).not.toContain("Jin-Woo");
  });

  it("stays within 3 sentences / roughly 45 words", () => {
    for (let seed = 0; seed < 50; seed++) {
      const msg = buildSystemMessage(baseContext(), fakeRng(seed));
      const sentences = msg.body.split(/(?<=[.!])\s+/).filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(3);
      expect(msg.body.split(/\s+/).length).toBeLessThanOrEqual(45);
    }
  });

  it("mentions the real exercise name and weight when there's a recent PR", () => {
    const msg = buildSystemMessage(
      baseContext({
        recentPr: { exerciseName: "Bench Press", newE1rmKg: 82.5 },
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Bench Press");
    expect(msg.body).toContain("82.5");
  });

  it("REGRESSION: never fabricates a number not present in the context", () => {
    // No PR in context — the message must not contain a bare weight-looking
    // number, since that would look like an invented stat.
    const ctx = baseContext({ recentPr: null });
    for (let seed = 0; seed < 20; seed++) {
      const msg = buildSystemMessage(ctx, fakeRng(seed));
      expect(msg.body).not.toMatch(/\d+(\.\d+)?\s*kg/);
    }
  });

  it("mentions today's program on a lifting day", () => {
    const msg = buildSystemMessage(
      baseContext({ todayProgramName: "Lower A", recentPr: null }),
      fakeRng(3),
    );
    expect(msg.body).toContain("Lower A");
  });

  it("references rest, not a program name, on a true rest day", () => {
    const msg = buildSystemMessage(
      baseContext({ todayProgramName: null, isRestDay: true, recentPr: null }),
      fakeRng(3),
    );
    expect(msg.body.toLowerCase()).not.toContain("upper");
    expect(msg.body.toLowerCase()).not.toContain("lower");
    expect(msg.body.toLowerCase()).toContain("rest");
  });

  it("REGRESSION: does not tell the Hunter to rest on a running day", () => {
    const msg = buildSystemMessage(
      baseContext({ todayProgramName: null, isRestDay: false, recentPr: null }),
      fakeRng(3),
    );
    expect(msg.body.toLowerCase()).not.toContain("rest");
    expect(msg.body.toLowerCase()).not.toContain("upper");
    expect(msg.body.toLowerCase()).not.toContain("lower");
  });

  it("source is always 'template' in this phase — no LLM exists yet", () => {
    const msg = buildSystemMessage(baseContext(), fakeRng(1));
    expect(msg.source).toBe("template");
  });

  it("is deterministic for a given seed", () => {
    const a = buildSystemMessage(baseContext(), fakeRng(42));
    const b = buildSystemMessage(baseContext(), fakeRng(42));
    expect(a.body).toBe(b.body);
  });
});

describe("daily quest and streak awareness", () => {
  it("names the outstanding daily quest ahead of the day's program", () => {
    const msg = buildSystemMessage(
      baseContext({ dailyQuestDone: false, todayProgramName: "Upper A" }),
      fakeRng(1),
    );
    expect(msg.body.toLowerCase()).toContain("daily quest");
  });

  it("reports a live streak with the real number once the quest is done", () => {
    const msg = buildSystemMessage(
      baseContext({ dailyQuestDone: true, streakDays: 6 }),
      fakeRng(1),
    );
    expect(msg.body).toContain("6");
  });

  it("REGRESSION: never claims a streak when there is none", () => {
    for (let seed = 0; seed < 20; seed++) {
      const msg = buildSystemMessage(
        baseContext({ dailyQuestDone: true, streakDays: 0 }),
        fakeRng(seed),
      );
      expect(msg.body.toLowerCase()).not.toContain("streak");
    }
  });

  it("REGRESSION: does not pluralize a one-day streak", () => {
    const msg = buildSystemMessage(
      baseContext({ dailyQuestDone: true, streakDays: 1 }),
      fakeRng(1),
    );
    expect(msg.body).toContain("1 day.");
    expect(msg.body).not.toContain("1 days");
  });
});

describe("penalty awareness", () => {
  it("leads with the penalty ahead of every other observation", () => {
    const msg = buildSystemMessage(
      baseContext({
        penaltyActive: true,
        recentPr: { exerciseName: "Bench Press", newE1rmKg: 90 },
      }),
      fakeRng(1),
    );
    expect(msg.body.toLowerCase()).toContain("penalty");
  });

  it("REGRESSION: says nothing at all once the System has gone silent", () => {
    for (let seed = 0; seed < 10; seed++) {
      const msg = buildSystemMessage(
        baseContext({ penaltyActive: true, penaltySilent: true }),
        fakeRng(seed),
      );
      expect(msg.body).toBe("");
    }
  });
});

describe("weakest shadow awareness", () => {
  it("names a weakening shadow when nothing more urgent is happening", () => {
    const msg = buildSystemMessage(
      baseContext({
        recentPr: null,
        dailyQuestDone: true,
        streakDays: 0,
        penaltyActive: false,
        weakestShadow: { name: "Iron", daysSinceTrained: 11 },
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Iron");
    expect(msg.body).toContain("11");
  });

  it("REGRESSION: a weakening shadow now outranks a recent PR", () => {
    // Inverted from the order this engine originally shipped with. That
    // order was the order features arrived in, not a designed order, and it
    // produced the one thing the voice rules forbid: congratulation while
    // something is rotting. Neglect is the urgent fact; the record is not.
    const msg = buildSystemMessage(
      baseContext({
        recentPr: { exerciseName: "Bench Press", newE1rmKg: 100 },
        weakestShadow: { name: "Iron", daysSinceTrained: 11 },
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Iron");
    expect(msg.body).not.toContain("Bench Press");
  });

  it("says nothing about shadows when none has weakened", () => {
    const msg = buildSystemMessage(
      baseContext({ recentPr: null, weakestShadow: null }),
      fakeRng(1),
    );
    expect(msg.body.toLowerCase()).not.toContain("weaken");
  });
});

describe("voice kinds and message shape", () => {
  it("pools only the kinds this app actually renders", () => {
    expect([...VOICE_POOL_KINDS]).toEqual(["briefing", "quest"]);
  });

  it("carries a severity alongside every body", () => {
    const msg = buildSystemMessage(baseContext(), fakeRng(1));
    expect(["info", "warning", "critical"]).toContain(msg.severity);
  });
});

describe("falling lift awareness", () => {
  it("names the lift that has fallen furthest, with the real number", () => {
    const msg = buildSystemMessage(
      baseContext({
        liftsDown: [
          { name: "Squat", deltaKg: -7.5 },
          { name: "Row", deltaKg: -2 },
        ],
        recentPr: { exerciseName: "Bench Press", newE1rmKg: 100 },
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Squat");
    expect(msg.body).toContain("7.5");
    expect(msg.body).not.toContain("Bench Press");
  });

  it("REGRESSION: a weakening shadow still outranks a falling lift", () => {
    const msg = buildSystemMessage(
      baseContext({
        liftsDown: [{ name: "Squat", deltaKg: -7.5 }],
        weakestShadow: { name: "Iron", daysSinceTrained: 11 },
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Iron");
    expect(msg.body).not.toContain("Squat");
  });

  it("says nothing about a falling lift when nothing has fallen", () => {
    const msg = buildSystemMessage(baseContext({ liftsDown: [] }), fakeRng(1));
    expect(msg.body.toLowerCase()).not.toContain("fallen");
  });

  it("REGRESSION: a falling lift still outranks an active streak", () => {
    const msg = buildSystemMessage(
      baseContext({
        liftsDown: [{ name: "Squat", deltaKg: -5 }],
        streakDays: 6,
      }),
      fakeRng(1),
    );
    expect(msg.body).toContain("Squat");
    expect(msg.body.toLowerCase()).not.toContain("streak");
  });

  it("REGRESSION: a penalty still outranks a weakening shadow", () => {
    const msg = buildSystemMessage(
      baseContext({
        penaltyActive: true,
        weakestShadow: { name: "Iron", daysSinceTrained: 11 },
      }),
      fakeRng(1),
    );
    expect(msg.body.toLowerCase()).toContain("penalty");
    expect(msg.body).not.toContain("Iron");
  });

  it("REGRESSION: a penalty still outranks a falling lift", () => {
    const msg = buildSystemMessage(
      baseContext({
        penaltyActive: true,
        liftsDown: [{ name: "Squat", deltaKg: -5 }],
      }),
      fakeRng(1),
    );
    expect(msg.body.toLowerCase()).toContain("penalty");
    expect(msg.body).not.toContain("Squat");
  });
});

describe("severity", () => {
  it("is critical inside the Penalty Zone", () => {
    expect(
      buildSystemMessage(baseContext({ penaltyActive: true }), fakeRng(1))
        .severity,
    ).toBe("critical");
  });

  it("is a warning when something is decaying or outstanding", () => {
    expect(
      buildSystemMessage(
        baseContext({ weakestShadow: { name: "Iron", daysSinceTrained: 11 } }),
        fakeRng(1),
      ).severity,
    ).toBe("warning");
    expect(
      buildSystemMessage(
        baseContext({ liftsDown: [{ name: "Squat", deltaKg: -5 }] }),
        fakeRng(1),
      ).severity,
    ).toBe("warning");
    expect(
      buildSystemMessage(baseContext({ dailyQuestDone: false }), fakeRng(1))
        .severity,
    ).toBe("warning");
  });

  it("is info on an ordinary day", () => {
    expect(buildSystemMessage(baseContext(), fakeRng(1)).severity).toBe("info");
  });

  it("REGRESSION: a silent System still returns a well-formed message", () => {
    const msg = buildSystemMessage(
      baseContext({ penaltyActive: true, penaltySilent: true }),
      fakeRng(1),
    );
    expect(msg.body).toBe("");
    expect(msg.severity).toBe("critical");
    expect(msg.source).toBe("template");
  });
});

/**
 * A context with one distinctive number per interpolation slot, so a test
 * can tell an interpolated number from a hard-coded one.
 */
function richContext(): SystemContext {
  return baseContext({
    streakDays: 6,
    weakestShadow: { name: "Iron", daysSinceTrained: 11 },
    liftsDown: [{ name: "Squat", deltaKg: -7.5 }],
    recentPr: { exerciseName: "Bench Press", newE1rmKg: 82.5 },
    todayProgramName: "Upper A",
  });
}

const ALLOWED_NUMBERS = [6, 11, 7.5, 82.5];

function assertToneDiscipline(copy: ToneCopy): void {
  const context = richContext();
  for (const branch of VOICE_BRANCHES) {
    const observation = copy.observation(context, branch);
    const demand = copy.demand(branch);
    expect(observation.length).toBeGreaterThan(0);
    expect(demand.length).toBeGreaterThan(0);

    for (const opening of copy.openings) {
      const line = `${opening} ${observation} ${demand}`;
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(line.split("!").length - 1).toBeLessThanOrEqual(1);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(45);
      for (const found of line.match(/\d+(?:\.\d+)?/g) ?? []) {
        expect(ALLOWED_NUMBERS).toContain(Number(found));
      }
    }
  }
}

describe("the tone copy tables", () => {
  it("names all nine branches, in the engine's own priority order", () => {
    expect([...VOICE_BRANCHES]).toEqual([
      "penalty",
      "shadow",
      "lift-down",
      "quest",
      "streak",
      "pr",
      "program",
      "rest",
      "run",
    ]);
  });

  it("REGRESSION: COLD_COPY still produces the exact strings shipping today", () => {
    // The Cold column is not being rewritten by this phase; a column is
    // being added beside it.
    const context = richContext();
    expect(COLD_COPY.observation(context, "pr")).toBe(
      "Bench Press: 82.5 kg. A new record.",
    );
    expect(COLD_COPY.demand("pr")).toBe("Do not let this be the last time.");
    expect(COLD_COPY.observation(context, "penalty")).toBe(
      "You are in the Penalty Zone.",
    );
    expect([...COLD_COPY.openings]).toEqual([
      "Hunter.",
      "System notice.",
      "Attention, Hunter.",
      "The System is watching.",
    ]);
  });
});

describe("MOCKING_COPY", () => {
  it("covers every branch and holds the template discipline", () => {
    assertToneDiscipline(MOCKING_COPY);
  });

  it("offers four openings, like every other voice", () => {
    expect(MOCKING_COPY.openings).toHaveLength(4);
  });

  it("reads the same numbers as Cold, and mocks only the words around them", () => {
    const context = richContext();
    const observation = MOCKING_COPY.observation(context, "pr");
    expect(observation).toContain("Bench Press");
    expect(observation).toContain("82.5");
    expect(observation).toContain("Predictable, eventually.");
    expect(MOCKING_COPY.demand("pr")).toBe(
      "Do it again before you start believing it means something.",
    );
  });

  it("REGRESSION: does not go soft on the branches that must not soften", () => {
    const context = richContext();
    expect(MOCKING_COPY.observation(context, "penalty")).toContain(
      "Penalty Zone",
    );
    expect(MOCKING_COPY.demand("penalty")).toContain("Survival Quest");
    expect(MOCKING_COPY.observation(context, "shadow")).toContain("Iron");
    expect(MOCKING_COPY.observation(context, "shadow")).toContain("11");
    expect(MOCKING_COPY.observation(context, "lift-down")).toContain("Squat");
    expect(MOCKING_COPY.observation(context, "lift-down")).toContain("7.5");
  });

  it("does not pluralize a one-day streak", () => {
    const single = MOCKING_COPY.observation(
      baseContext({ streakDays: 1 }),
      "streak",
    );
    expect(single).toContain("1 day.");
    expect(single).not.toContain("1 days");
  });
});

describe("ANCIENT_COPY", () => {
  it("covers every branch and holds the template discipline", () => {
    assertToneDiscipline(ANCIENT_COPY);
  });

  it("offers four openings, like every other voice", () => {
    expect(ANCIENT_COPY.openings).toHaveLength(4);
  });

  it("reads the same numbers as Cold, in ceremonial words", () => {
    const context = richContext();
    const observation = ANCIENT_COPY.observation(context, "pr");
    expect(observation).toContain("Bench Press");
    expect(observation).toContain("82.5");
    expect(observation).toContain("hath grown");
    expect(ANCIENT_COPY.demand("pr")).toBe(
      "Rest not upon it — the Gate awaits thy return.",
    );
  });

  it("REGRESSION: uses no contractions anywhere, which is the one rule this voice adds", () => {
    const context = richContext();
    for (const branch of VOICE_BRANCHES) {
      const line = `${ANCIENT_COPY.observation(context, branch)} ${ANCIENT_COPY.demand(branch)}`;
      // An apostrophe followed by a letter is a contraction; this voice has
      // no legitimate use for one.
      expect(line).not.toMatch(/'\p{Letter}/u);
    }
    for (const opening of ANCIENT_COPY.openings) {
      expect(opening).not.toMatch(/'\p{Letter}/u);
    }
  });

  it("REGRESSION: still passes judgment rather than offering comfort", () => {
    // The place this voice is most likely to slip: archaic language pulls
    // hard toward benediction, and a stately consolation in the Penalty
    // Zone would be the same failure as praise.
    const context = richContext();
    expect(ANCIENT_COPY.observation(context, "penalty")).toContain(
      "Penalty Zone",
    );
    expect(ANCIENT_COPY.demand("penalty")).toContain("Survival Quest");
    expect(ANCIENT_COPY.observation(context, "shadow")).toContain("Iron");
    expect(ANCIENT_COPY.observation(context, "shadow")).toContain("11");
    expect(ANCIENT_COPY.observation(context, "lift-down")).toContain("Squat");
    expect(ANCIENT_COPY.observation(context, "lift-down")).toContain("7.5");
  });

  it("still addresses the reader as Hunter, which is a form of address and not a style choice", () => {
    for (const opening of ANCIENT_COPY.openings) {
      expect(opening).toContain("Hunter");
    }
  });

  it("does not pluralize a one-day streak", () => {
    const single = ANCIENT_COPY.observation(
      baseContext({ streakDays: 1 }),
      "streak",
    );
    expect(single).toContain("1 day.");
    expect(single).not.toContain("1 days");
  });
});

describe("MERCILESS_COPY", () => {
  it("covers every branch and holds the template discipline", () => {
    assertToneDiscipline(MERCILESS_COPY);
  });

  it("offers four openings, like every other voice", () => {
    expect(MERCILESS_COPY.openings).toHaveLength(4);
  });

  it("reads the same numbers as Cold, with everything else stripped out", () => {
    const context = richContext();
    const observation = MERCILESS_COPY.observation(context, "pr");
    expect(observation).toContain("Bench Press");
    expect(observation).toContain("82.5");
    expect(observation).toContain("New maximum. Noted.");
    expect(MERCILESS_COPY.demand("pr")).toBe(
      "The next one will not come from standing still.",
    );
  });

  it("REGRESSION: stays inside the anchor Cold set — at most 20 words composed", () => {
    // The whole point of this voice. Cold composes to 12-20 words, and that
    // is the anchor every voice is measured against; if a Merciless branch
    // ever drifts past it, the copy has stopped being what was bought.
    // Eight of the nine branches are strictly shorter than Cold's; the `pr`
    // branch is not, because its demand line is fixed copy that predates
    // this test and is not up for shortening.
    const context = richContext();
    for (const branch of VOICE_BRANCHES) {
      for (const opening of MERCILESS_COPY.openings) {
        const line = `${opening} ${MERCILESS_COPY.observation(context, branch)} ${MERCILESS_COPY.demand(branch)}`;
        expect(line.split(/\s+/).length).toBeLessThanOrEqual(20);
      }
    }
  });

  it("is shorter than Cold on every branch except the one whose demand is fixed copy", () => {
    const context = richContext();
    const shorter = VOICE_BRANCHES.filter((branch) => {
      const merciless = `${MERCILESS_COPY.observation(context, branch)} ${MERCILESS_COPY.demand(branch)}`;
      const cold = `${COLD_COPY.observation(context, branch)} ${COLD_COPY.demand(branch)}`;
      return merciless.split(/\s+/).length < cold.split(/\s+/).length;
    });
    expect(shorter).not.toContain("pr");
    expect(shorter).toHaveLength(VOICE_BRANCHES.length - 1);
  });

  it("REGRESSION: never softens or qualifies a failure", () => {
    const context = richContext();
    expect(MERCILESS_COPY.observation(context, "penalty")).toContain(
      "Penalty Zone",
    );
    expect(MERCILESS_COPY.demand("penalty")).toContain("Survival Quest");
    expect(MERCILESS_COPY.observation(context, "shadow")).toContain("Iron");
    expect(MERCILESS_COPY.observation(context, "shadow")).toContain("11");
    expect(MERCILESS_COPY.observation(context, "lift-down")).toContain("Squat");
    expect(MERCILESS_COPY.observation(context, "lift-down")).toContain("7.5");
  });

  it("does not pluralize a one-day streak", () => {
    const single = MERCILESS_COPY.observation(
      baseContext({ streakDays: 1 }),
      "streak",
    );
    expect(single).toContain("1 day.");
    expect(single).not.toContain("1 days");
  });
});
