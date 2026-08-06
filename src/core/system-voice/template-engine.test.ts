import { describe, it, expect } from "vitest";
import type { RngPort } from "@/ports/rng.port";
import { buildSystemMessage, type SystemContext } from "./template-engine";

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
    todayProgramName: "Upper A",
    isRestDay: false,
    streakDays: 0,
    // Defaults to true so pre-existing tests that don't care about the
    // quest-pending branch still exercise the program/rest/run branches
    // below it — only tests that explicitly set this to false test that
    // branch's priority.
    dailyQuestDone: true,
    recentPr: null,
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
