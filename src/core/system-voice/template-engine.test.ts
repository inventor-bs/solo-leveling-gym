import { describe, it, expect } from "vitest";
import { seededRng } from "@/infra/rng/seeded-rng";
import { buildSystemMessage, type SystemContext } from "./template-engine";

function baseContext(patch: Partial<SystemContext> = {}): SystemContext {
  return {
    hunterName: "Jin-Woo",
    level: 2,
    rank: "E",
    todayProgramName: "Upper A",
    recentPr: null,
    ...patch,
  };
}

describe("buildSystemMessage", () => {
  it("always addresses the hunter as 'Hunter', never by name, per the voice rules", () => {
    const msg = buildSystemMessage(baseContext(), seededRng(1));
    expect(msg.body).toMatch(/Hunter/);
    expect(msg.body).not.toContain("Jin-Woo");
  });

  it("stays within 3 sentences / roughly 45 words", () => {
    for (let seed = 0; seed < 50; seed++) {
      const msg = buildSystemMessage(baseContext(), seededRng(seed));
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
      seededRng(1),
    );
    expect(msg.body).toContain("Bench Press");
    expect(msg.body).toContain("82.5");
  });

  it("REGRESSION: never fabricates a number not present in the context", () => {
    // No PR in context — the message must not contain a bare weight-looking
    // number, since that would look like an invented stat.
    const ctx = baseContext({ recentPr: null });
    for (let seed = 0; seed < 20; seed++) {
      const msg = buildSystemMessage(ctx, seededRng(seed));
      expect(msg.body).not.toMatch(/\d+(\.\d+)?\s*kg/);
    }
  });

  it("mentions today's program on a lifting day", () => {
    const msg = buildSystemMessage(
      baseContext({ todayProgramName: "Lower A", recentPr: null }),
      seededRng(3),
    );
    expect(msg.body).toContain("Lower A");
  });

  it("references rest, not a program name, when there is none scheduled", () => {
    const msg = buildSystemMessage(
      baseContext({ todayProgramName: null, recentPr: null }),
      seededRng(3),
    );
    expect(msg.body.toLowerCase()).not.toContain("upper");
    expect(msg.body.toLowerCase()).not.toContain("lower");
  });

  it("source is always 'template' in this phase — no LLM exists yet", () => {
    const msg = buildSystemMessage(baseContext(), seededRng(1));
    expect(msg.source).toBe("template");
  });

  it("is deterministic for a given seed", () => {
    const a = buildSystemMessage(baseContext(), seededRng(42));
    const b = buildSystemMessage(baseContext(), seededRng(42));
    expect(a.body).toBe(b.body);
  });
});
