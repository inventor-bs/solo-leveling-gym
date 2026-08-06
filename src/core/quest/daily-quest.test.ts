import { describe, it, expect } from "vitest";
import {
  dailyQuestTargets,
  isQuestComplete,
  questCompletionPercent,
  type QuestProgress,
} from "./daily-quest";

const zero: QuestProgress = { pushups: 0, situps: 0, squats: 0, runKm: 0 };

describe("dailyQuestTargets", () => {
  it("starts an E-rank hunter at 20/20/20 and 1 km, not at Jin-Woo's 100s", () => {
    expect(dailyQuestTargets("E")).toEqual({
      pushups: 20,
      situps: 20,
      squats: 20,
      runKm: 1,
    });
  });

  it("reaches 100/100/100 and 10 km only at S-rank", () => {
    expect(dailyQuestTargets("S")).toEqual({
      pushups: 100,
      situps: 100,
      squats: 100,
      runKm: 10,
    });
  });

  it("scales monotonically across E through S", () => {
    const ranks = ["E", "D", "C", "B", "A", "S"] as const;
    for (let i = 1; i < ranks.length; i++) {
      const prev = dailyQuestTargets(ranks[i - 1]!);
      const curr = dailyQuestTargets(ranks[i]!);
      expect(curr.pushups).toBeGreaterThan(prev.pushups);
      expect(curr.runKm).toBeGreaterThan(prev.runKm);
    }
  });

  it("caps National and Monarch at the S-rank load rather than inventing numbers", () => {
    expect(dailyQuestTargets("National")).toEqual(dailyQuestTargets("S"));
    expect(dailyQuestTargets("Monarch")).toEqual(dailyQuestTargets("S"));
  });
});

describe("isQuestComplete", () => {
  it("is false when nothing has been done", () => {
    expect(isQuestComplete(dailyQuestTargets("E"), zero)).toBe(false);
  });

  it("is false when only the run is missing", () => {
    const t = dailyQuestTargets("E");
    expect(
      isQuestComplete(t, { pushups: 20, situps: 20, squats: 20, runKm: 0.9 }),
    ).toBe(false);
  });

  it("is true when every requirement is met exactly", () => {
    const t = dailyQuestTargets("E");
    expect(
      isQuestComplete(t, { pushups: 20, situps: 20, squats: 20, runKm: 1 }),
    ).toBe(true);
  });

  it("is true when requirements are exceeded", () => {
    const t = dailyQuestTargets("E");
    expect(
      isQuestComplete(t, { pushups: 99, situps: 40, squats: 25, runKm: 3.2 }),
    ).toBe(true);
  });
});

describe("questCompletionPercent", () => {
  it("is 0 for no progress and 100 for a finished quest", () => {
    const t = dailyQuestTargets("E");
    expect(questCompletionPercent(t, zero)).toBe(0);
    expect(
      questCompletionPercent(t, {
        pushups: 20,
        situps: 20,
        squats: 20,
        runKm: 1,
      }),
    ).toBe(100);
  });

  it("averages the four requirements and never exceeds 100 when one is overshot", () => {
    const t = dailyQuestTargets("E");
    // Pushups tripled, everything else untouched: one maxed of four = 25%.
    expect(
      questCompletionPercent(t, {
        pushups: 60,
        situps: 0,
        squats: 0,
        runKm: 0,
      }),
    ).toBe(25);
  });
});
