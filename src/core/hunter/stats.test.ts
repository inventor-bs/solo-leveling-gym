import { describe, it, expect } from "vitest";
import { kg } from "@/core/shared/units";
import { deriveStats, emptyStatInput, type StatInput } from "./stats";

function input(patch: Partial<StatInput> = {}): StatInput {
  return { ...emptyStatInput(), ...patch };
}

describe("deriveStats — STR", () => {
  it("is 0 when nothing has been trained", () => {
    expect(deriveStats(emptyStatInput()).strength).toBe(0);
  });

  it("is computed from the sum of main-lift e1RMs", () => {
    const s = deriveStats(
      input({
        mainLiftE1rms: new Map([
          ["bench", kg(96)],
          ["squat", kg(120)],
          ["deadlift", kg(144)],
          ["ohp", kg(60)],
          ["row", kg(84)],
        ]),
      }),
    );
    // (96+120+144+60+84) / 10 = 50.4 -> 50
    expect(s.strength).toBe(50);
  });

  it("increases as e1RM increases", () => {
    const before = deriveStats(
      input({ mainLiftE1rms: new Map([["bench", kg(90)]]) }),
    ).strength;
    const after = deriveStats(
      input({ mainLiftE1rms: new Map([["bench", kg(120)]]) }),
    ).strength;
    expect(after).toBeGreaterThan(before);
  });
});

describe("deriveStats — AGI", () => {
  it("is 0 with no running", () => {
    expect(deriveStats(emptyStatInput()).agility).toBe(0);
  });

  it("increases with distance", () => {
    const s = deriveStats(input({ km28d: 40, avgPaceSecPerKm: null }));
    expect(s.agility).toBe(60); // 40 * 1.5
  });

  it("rewards a pace faster than 7:00/km", () => {
    const slow = deriveStats(input({ km28d: 40, avgPaceSecPerKm: 420 }));
    const fast = deriveStats(input({ km28d: 40, avgPaceSecPerKm: 300 }));
    expect(slow.agility).toBe(60);
    expect(fast.agility).toBe(80); // 60 + (420-300)/6
  });

  it("a pace slower than 7:00/km isn't penalized below 0", () => {
    const s = deriveStats(input({ km28d: 10, avgPaceSecPerKm: 600 }));
    expect(s.agility).toBe(15);
  });

  it("the pace bonus is capped at 30", () => {
    const s = deriveStats(input({ km28d: 0, avgPaceSecPerKm: 100 }));
    expect(s.agility).toBe(30);
  });
});

describe("deriveStats — VIT", () => {
  it("combines volume and session count", () => {
    const s = deriveStats(
      input({ volume28d: 40000, sessionsCompleted28d: 16 }),
    );
    // 40000/2000 + 16*1.5 = 20 + 24 = 44
    expect(s.vitality).toBe(44);
  });

  it("is 0 when nothing has been trained", () => {
    expect(deriveStats(emptyStatInput()).vitality).toBe(0);
  });
});

describe("deriveStats — PER", () => {
  it("is the percentage of sets completed vs. planned", () => {
    const s = deriveStats(
      input({ setsCompleted28d: 180, setsPlanned28d: 200 }),
    );
    expect(s.perception).toBe(90);
  });

  it("is 0 when there was no plan at all", () => {
    expect(deriveStats(emptyStatInput()).perception).toBe(0);
  });

  it("is capped at 100 even when over-performing", () => {
    const s = deriveStats(
      input({ setsCompleted28d: 250, setsPlanned28d: 200 }),
    );
    expect(s.perception).toBe(100);
  });
});

describe("deriveStats — INT", () => {
  it("combines schedule adherence and side quests", () => {
    const s = deriveStats(
      input({
        sessionsCompleted28d: 16,
        sessionsScheduled28d: 16,
        sideQuestsCompleted28d: 14,
        sideQuestsIssued28d: 28,
      }),
    );
    // 0.7*100 + 0.3*50 = 70 + 15 = 85
    expect(s.intelligence).toBe(85);
  });

  it("counts only schedule adherence when there are no side quests yet", () => {
    const s = deriveStats(
      input({ sessionsCompleted28d: 12, sessionsScheduled28d: 16 }),
    );
    // 0.7*75 = 52.5 -> 53
    expect(s.intelligence).toBe(53);
  });
});

describe("deriveStats — LUCK", () => {
  it("increases with streak and hidden quests", () => {
    const s = deriveStats(input({ streakDays: 30, hiddenQuestsFound: 4 }));
    // 30*0.8 + 4*5 = 24 + 20 = 44
    expect(s.luck).toBe(44);
  });

  it("is 0 with no streak", () => {
    expect(deriveStats(emptyStatInput()).luck).toBe(0);
  });

  it("is capped at 100", () => {
    const s = deriveStats(input({ streakDays: 365, hiddenQuestsFound: 50 }));
    expect(s.luck).toBe(100);
  });
});

describe("deriveStats — general properties", () => {
  it("every stat is a non-negative integer", () => {
    const s = deriveStats(
      input({
        mainLiftE1rms: new Map([["bench", kg(96)]]),
        km28d: 33.3,
        avgPaceSecPerKm: 355,
        volume28d: 41234,
        sessionsCompleted28d: 13,
        sessionsScheduled28d: 16,
        setsCompleted28d: 177,
        setsPlanned28d: 200,
        streakDays: 7,
        hiddenQuestsFound: 1,
      }),
    );
    for (const v of Object.values(s)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("REGRESSION: stopping training drives stats down (detraining)", () => {
    const active = deriveStats(
      input({ volume28d: 40000, sessionsCompleted28d: 16 }),
    );
    const stopped = deriveStats(
      input({ volume28d: 0, sessionsCompleted28d: 0 }),
    );
    expect(stopped.vitality).toBeLessThan(active.vitality);
  });
});
