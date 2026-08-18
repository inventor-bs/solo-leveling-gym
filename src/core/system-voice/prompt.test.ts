import { describe, it, expect } from "vitest";
import { buildVoicePlan, contextNumbers, voiceRulesFor } from "./prompt";
import { VOICE_TONE_CATALOG } from "./tone";
import type { SystemContext } from "./types";

function ctx(patch: Partial<SystemContext> = {}): SystemContext {
  return {
    hunterName: "Jin-Woo",
    level: 12,
    rank: "D",
    title: null,
    className: null,
    streakDays: 4,
    fatigue: 2.5,
    reasonForHunting: "To stop being the weakest",
    todayProgramName: "Upper A",
    todayMainLift: "Bench Press",
    isRestDay: false,
    dailyQuestDone: false,
    sessionsLast7d: 3,
    missedDays30d: 2,
    penaltyCount30d: 1,
    liftsUp: [{ name: "Bench Press", deltaKg: 7.5 }],
    liftsDown: [{ name: "Squat", deltaKg: -5 }],
    recentPr: null,
    penaltyActive: false,
    penaltySilent: false,
    weakestShadow: { name: "Iron", daysSinceTrained: 11 },
    armyRank: "C",
    arcStage: "anomaly",
    unlockedFragments: ["first-anomaly"],
    lastMessages: ["Hunter. The Daily Quest is not complete."],
    ...patch,
  };
}

describe("contextNumbers", () => {
  it("collects every number the voice is permitted to say", () => {
    const numbers = contextNumbers(ctx());
    for (const n of [12, 4, 3, 2, 1, 7.5, 5, 11]) {
      expect(numbers).toContain(n);
    }
  });

  it("reports falls as positive magnitudes, matching how they get spoken", () => {
    expect(contextNumbers(ctx())).toContain(5);
    expect(contextNumbers(ctx())).not.toContain(-5);
  });

  it("includes a PR weight when there is one", () => {
    const numbers = contextNumbers(
      ctx({ recentPr: { exerciseName: "Bench Press", newE1rmKg: 82.5 } }),
    );
    expect(numbers).toContain(82.5);
  });

  it("REGRESSION: reports no numbers a context with nothing in it could justify", () => {
    const empty = ctx({
      level: 1,
      streakDays: 0,
      fatigue: 0,
      sessionsLast7d: 0,
      missedDays30d: 0,
      penaltyCount30d: 0,
      liftsUp: [],
      liftsDown: [],
      recentPr: null,
      weakestShadow: null,
      unlockedFragments: [],
    });
    expect(contextNumbers(empty).filter((n) => n > 1)).toEqual([]);
  });
});

describe("buildVoicePlan", () => {
  it("states the voice rules in the system prompt", () => {
    const plan = buildVoicePlan("briefing", ctx(), null);
    expect(plan.request.systemPrompt).toContain("Hunter");
    expect(plan.request.systemPrompt).toContain("3 sentences");
    expect(plan.request.systemPrompt).toContain("45 words");
    expect(plan.request.systemPrompt.toLowerCase()).toContain("never invent");
  });

  it("puts the real facts in the user prompt", () => {
    const plan = buildVoicePlan("briefing", ctx(), null);
    expect(plan.request.userPrompt).toContain("level: 12");
    expect(plan.request.userPrompt).toContain("Iron");
    expect(plan.request.userPrompt).toContain("Squat");
  });

  it("REGRESSION: never puts the hunter's real name in any prompt", () => {
    const plan = buildVoicePlan("briefing", ctx(), null);
    expect(plan.request.systemPrompt).not.toContain("Jin-Woo");
    expect(plan.request.userPrompt).not.toContain("Jin-Woo");
  });

  it("forbids the hunter's name at the gate as well as in the prompt", () => {
    expect(buildVoicePlan("briefing", ctx(), null).forbiddenText).toContain(
      "Jin-Woo",
    );
  });

  it("shows the model what it already said, so it stops repeating itself", () => {
    const plan = buildVoicePlan("briefing", ctx(), null);
    expect(plan.request.userPrompt).toContain(
      "Hunter. The Daily Quest is not complete.",
    );
  });

  it("gives the quest kind a different instruction from the briefing", () => {
    const briefing = buildVoicePlan("briefing", ctx(), null).request.userPrompt;
    const quest = buildVoicePlan("quest", ctx(), null).request.userPrompt;
    expect(quest).not.toBe(briefing);
    expect(quest.toLowerCase()).toContain("daily quest");
  });

  it("carries the same allowed numbers the gate will check against", () => {
    const plan = buildVoicePlan("briefing", ctx(), null);
    expect(plan.allowedNumbers).toEqual(contextNumbers(ctx()));
  });

  it("is deterministic — the same context builds the same prompt", () => {
    expect(buildVoicePlan("briefing", ctx(), null)).toEqual(
      buildVoicePlan("briefing", ctx(), null),
    );
  });

  it("REGRESSION: every number the FACTS block shows is in the allowed whitelist, matching what the moderation gate will actually parse", () => {
    const plan = buildVoicePlan(
      "briefing",
      ctx({ liftsDown: [{ name: "Squat", deltaKg: -7.5 }] }),
      null,
    );
    const numbersInPrompt =
      plan.request.userPrompt.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    for (const n of numbersInPrompt) {
      expect(plan.allowedNumbers.some((a) => Math.abs(a - n) < 1e-9)).toBe(
        true,
      );
    }
  });
});

/**
 * The exact string this module produced before tones existed. Inlined
 * rather than imported so the assertion below compares against a frozen
 * copy: if the source constant is edited, this test fails, which is the
 * entire point of it.
 */
const VOICE_RULES_BEFORE_THIS_PHASE = [
  "You are The System: a cold evaluation program that speaks to one person.",
  'Address the reader as "Hunter". You do not know their name and must never guess one.',
  "State a fact first, then issue a demand. Do not explain yourself and do not ask permission.",
  "Never offer encouragement, praise, sympathy, or reassurance of any kind.",
  "At most 3 sentences and at most 45 words.",
  "No emoji. At most one exclamation mark in total.",
  "Use ONLY numbers that appear in the FACTS block. Never invent a number, a date, or a weight.",
  "Do not repeat an observation that appears in RECENTLY SAID.",
  'Reply with JSON only: {"body": string, "severity": "info" | "warning" | "critical", "title": string | null}',
].join("\n");

describe("voiceRulesFor", () => {
  it("REGRESSION: Cold is byte-for-byte the prompt that shipped before tones existed", () => {
    // The most important assertion in this phase. A hunter who has bought
    // nothing must not receive a different prompt because a cosmetic
    // feature refactored around them.
    expect(voiceRulesFor(null)).toBe(VOICE_RULES_BEFORE_THIS_PHASE);
  });

  it("keeps every base rule in every tone", () => {
    for (const tone of VOICE_TONE_CATALOG) {
      for (const line of VOICE_RULES_BEFORE_THIS_PHASE.split("\n")) {
        expect(voiceRulesFor(tone.id)).toContain(line);
      }
    }
  });

  it("REGRESSION: ends with the JSON instruction in every tone", () => {
    // The style block is inserted BEFORE the format rule, never appended
    // after it: the output contract must be the last thing the model reads.
    const jsonLine = VOICE_RULES_BEFORE_THIS_PHASE.split("\n").at(-1);
    for (const tone of [null, ...VOICE_TONE_CATALOG.map((t) => t.id)]) {
      const lines = voiceRulesFor(tone).split("\n");
      expect(lines.at(-1)).toBe(jsonLine);
    }
  });

  it("gives each tone its own style block and none of the others'", () => {
    const mocking = voiceRulesFor("mocking");
    const ancient = voiceRulesFor("ancient");
    const merciless = voiceRulesFor("merciless");

    expect(mocking).toContain("STYLE: contemptuous and challenging.");
    expect(ancient).toContain("STYLE: formal and ceremonial,");
    expect(merciless).toContain("STYLE: maximum brevity.");

    expect(mocking).not.toContain("STYLE: formal and ceremonial,");
    expect(mocking).not.toContain("STYLE: maximum brevity.");
    expect(ancient).not.toContain("STYLE: contemptuous and challenging.");
    expect(ancient).not.toContain("STYLE: maximum brevity.");
    expect(merciless).not.toContain("STYLE: contemptuous and challenging.");
    expect(merciless).not.toContain("STYLE: formal and ceremonial,");
  });

  it("REGRESSION: no tone loosens the rule against comfort", () => {
    // The four voices differ in the KIND of cold they are, never in how
    // warm they are allowed to be.
    for (const tone of [null, ...VOICE_TONE_CATALOG.map((t) => t.id)]) {
      expect(voiceRulesFor(tone)).toContain(
        "Never offer encouragement, praise, sympathy, or reassurance of any kind.",
      );
      expect(voiceRulesFor(tone)).toContain("At most 3 sentences");
      expect(voiceRulesFor(tone)).toContain("At most one exclamation mark");
    }
  });
});

describe("buildVoicePlan across tones", () => {
  it("puts the tone's rules in the system prompt and nowhere else", () => {
    const plan = buildVoicePlan("briefing", ctx(), "ancient");
    expect(plan.request.systemPrompt).toBe(voiceRulesFor("ancient"));
    expect(plan.request.userPrompt).not.toContain("STYLE:");
  });

  it("REGRESSION: builds an identical user prompt, whitelist and forbidden list in every tone", () => {
    // The facts a voice may state are decided before the voice is known.
    // If this ever fails, one voice has won the right to say a number the
    // others cannot, and the single anti-hallucination whitelist has become
    // four different whitelists.
    const cold = buildVoicePlan("briefing", ctx(), null);
    for (const tone of VOICE_TONE_CATALOG) {
      const plan = buildVoicePlan("briefing", ctx(), tone.id);
      expect(plan.request.userPrompt).toBe(cold.request.userPrompt);
      expect(plan.allowedNumbers).toEqual(cold.allowedNumbers);
      expect(plan.forbiddenText).toEqual(cold.forbiddenText);
    }
  });

  it("REGRESSION: still keeps the hunter's real name out of every tone's prompt", () => {
    for (const tone of VOICE_TONE_CATALOG) {
      const plan = buildVoicePlan("briefing", ctx(), tone.id);
      expect(plan.request.systemPrompt).not.toContain("Jin-Woo");
      expect(plan.request.userPrompt).not.toContain("Jin-Woo");
    }
  });
});
