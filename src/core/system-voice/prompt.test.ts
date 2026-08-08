import { describe, it, expect } from "vitest";
import { buildVoicePlan, contextNumbers } from "./prompt";
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
    const plan = buildVoicePlan("briefing", ctx());
    expect(plan.request.systemPrompt).toContain("Hunter");
    expect(plan.request.systemPrompt).toContain("3 sentences");
    expect(plan.request.systemPrompt).toContain("45 words");
    expect(plan.request.systemPrompt.toLowerCase()).toContain("never invent");
  });

  it("puts the real facts in the user prompt", () => {
    const plan = buildVoicePlan("briefing", ctx());
    expect(plan.request.userPrompt).toContain("level: 12");
    expect(plan.request.userPrompt).toContain("Iron");
    expect(plan.request.userPrompt).toContain("Squat");
  });

  it("REGRESSION: never puts the hunter's real name in any prompt", () => {
    const plan = buildVoicePlan("briefing", ctx());
    expect(plan.request.systemPrompt).not.toContain("Jin-Woo");
    expect(plan.request.userPrompt).not.toContain("Jin-Woo");
  });

  it("forbids the hunter's name at the gate as well as in the prompt", () => {
    expect(buildVoicePlan("briefing", ctx()).forbiddenText).toContain(
      "Jin-Woo",
    );
  });

  it("shows the model what it already said, so it stops repeating itself", () => {
    const plan = buildVoicePlan("briefing", ctx());
    expect(plan.request.userPrompt).toContain(
      "Hunter. The Daily Quest is not complete.",
    );
  });

  it("gives the quest kind a different instruction from the briefing", () => {
    const briefing = buildVoicePlan("briefing", ctx()).request.userPrompt;
    const quest = buildVoicePlan("quest", ctx()).request.userPrompt;
    expect(quest).not.toBe(briefing);
    expect(quest.toLowerCase()).toContain("daily quest");
  });

  it("carries the same allowed numbers the gate will check against", () => {
    const plan = buildVoicePlan("briefing", ctx());
    expect(plan.allowedNumbers).toEqual(contextNumbers(ctx()));
  });

  it("is deterministic — the same context builds the same prompt", () => {
    expect(buildVoicePlan("briefing", ctx())).toEqual(
      buildVoicePlan("briefing", ctx()),
    );
  });
});
