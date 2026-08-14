import { describe, it, expect } from "vitest";
import {
  PR_GOLD,
  LEVEL_UP_GOLD_PER_LEVEL,
  PERFECT_WEEK_GOLD,
  INSTANT_DUNGEON_KEY_COST,
  RED_GATE_COST,
  RED_GATE_VOLUME_RATIO,
  RED_GATE_REWARD_MULTIPLIER,
  BOSS_RAID_COST,
  BOSS_RAID_PR_GOLD,
  DEMON_CASTLE_FLOOR_COST,
  DEMON_CASTLE_RATIO_PER_FLOOR,
  PROGRAM_PPL_COST,
  PROGRAM_PPL_MIN_LEVEL,
  PROGRAM_531_COST,
  PROGRAM_531_MIN_LEVEL,
  PROGRAM_ARNOLD_COST,
  PROGRAM_ARNOLD_MIN_LEVEL,
  EXERCISE_UNLOCK_COST,
  DUNGEON_TYPE_COST,
  WAGER_MAX_STAKE_FRACTION,
  WAGER_PAYOUT_MULTIPLIER,
  WAGER_TARGET_DUNGEONS,
  WAGER_TARGET_RUNS,
  WAGER_TARGET_QUESTS,
  EQUIPMENT_BASE_DROP_RATE,
  LUCK_DROP_COEFFICIENT,
  EQUIPMENT_GRADES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_GRADE_WEIGHTS,
  EQUIPMENT_GRADE_BONUS,
  HOURGLASS_OF_GRACE_COST,
  HOURGLASS_MAX_PER_WEEK,
  SHADOW_FEED_COST,
  SHADOW_FEED_DAYS,
  DASHBOARD_LAYOUT_COST,
  SHADOW_SKIN_COST,
  TITLE_FRAME_COST,
  AURA_BASE_COST,
  AURA_COST_GROWTH,
  AURA_VISUAL_MAX_LEVEL,
} from "./pricing";

describe("income pricing", () => {
  it("pays 150 gold per PR and 100 gold per new level", () => {
    expect(PR_GOLD).toBe(150);
    expect(LEVEL_UP_GOLD_PER_LEVEL).toBe(100);
  });

  it("pays 500 gold for a perfect week", () => {
    expect(PERFECT_WEEK_GOLD).toBe(500);
  });
});

describe("challenge pricing", () => {
  it("prices the four harder-content items", () => {
    expect(INSTANT_DUNGEON_KEY_COST).toBe(800);
    expect(RED_GATE_COST).toBe(2_500);
    expect(BOSS_RAID_COST).toBe(4_000);
    expect(DEMON_CASTLE_FLOOR_COST).toBe(1_500);
  });

  it("sets the Red Gate target at 1.5x average volume for a 4x reward", () => {
    expect(RED_GATE_VOLUME_RATIO).toBe(1.5);
    expect(RED_GATE_REWARD_MULTIPLIER).toBe(4);
  });

  it("doubles PR gold inside a Boss Raid", () => {
    expect(BOSS_RAID_PR_GOLD).toBe(300);
    expect(BOSS_RAID_PR_GOLD).toBe(PR_GOLD * 2);
  });

  it("raises the Demon Castle target by 10% of average volume per floor", () => {
    expect(DEMON_CASTLE_RATIO_PER_FLOOR).toBe(0.1);
  });
});

describe("unlock pricing", () => {
  it("prices and gates the three programs", () => {
    expect(PROGRAM_PPL_COST).toBe(3_000);
    expect(PROGRAM_PPL_MIN_LEVEL).toBe(20);
    expect(PROGRAM_531_COST).toBe(5_000);
    expect(PROGRAM_531_MIN_LEVEL).toBe(30);
    expect(PROGRAM_ARNOLD_COST).toBe(6_000);
    expect(PROGRAM_ARNOLD_MIN_LEVEL).toBe(35);
  });

  it("prices an exercise unlock and each dungeon type", () => {
    expect(EXERCISE_UNLOCK_COST).toBe(400);
    expect(DUNGEON_TYPE_COST).toBe(1_200);
  });
});

describe("wager pricing", () => {
  it("caps the stake at half the hunter's gold and pays 3x on a win", () => {
    expect(WAGER_MAX_STAKE_FRACTION).toBe(0.5);
    expect(WAGER_PAYOUT_MULTIPLIER).toBe(3);
  });

  it("fixes the weekly contract at 4 dungeons, 2 runs, 7 quests", () => {
    expect(WAGER_TARGET_DUNGEONS).toBe(4);
    expect(WAGER_TARGET_RUNS).toBe(2);
    expect(WAGER_TARGET_QUESTS).toBe(7);
  });
});

describe("equipment pricing", () => {
  it("uses the per-rank base drop rate table", () => {
    expect(EQUIPMENT_BASE_DROP_RATE).toEqual({
      E: 0.03,
      D: 0.05,
      C: 0.08,
      B: 0.11,
      A: 0.15,
    });
  });

  it("adds a LUCK bonus of at most 0.1 at the LUCK cap of 100", () => {
    expect(LUCK_DROP_COEFFICIENT).toBe(0.1);
    expect((100 / 100) * LUCK_DROP_COEFFICIENT).toBeCloseTo(0.1, 10);
  });

  it("lists five grades weakest first and three slots", () => {
    expect(EQUIPMENT_GRADES).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ]);
    expect(EQUIPMENT_SLOTS).toEqual(["weapon", "armor", "accessory"]);
  });

  it("skews the grade roll toward common, with weights summing to 1", () => {
    const weights = EQUIPMENT_GRADES.map((g) => EQUIPMENT_GRADE_WEIGHTS[g]);
    expect(weights).toEqual([0.5, 0.28, 0.14, 0.06, 0.02]);
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 9);
    // Strictly descending: every step down the ladder must be rarer.
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i]!).toBeLessThan(weights[i - 1]!);
    }
  });

  it("scales the grade effect from 5% to 25% in 5-point steps", () => {
    expect(EQUIPMENT_GRADES.map((g) => EQUIPMENT_GRADE_BONUS[g])).toEqual([
      0.05, 0.1, 0.15, 0.2, 0.25,
    ]);
  });
});

describe("penalty mitigation pricing", () => {
  it("prices the Hourglass at 1000 gold, once a week", () => {
    expect(HOURGLASS_OF_GRACE_COST).toBe(1_000);
    expect(HOURGLASS_MAX_PER_WEEK).toBe(1);
  });

  it("prices the Shadow Feed at 600 gold for 3 days", () => {
    expect(SHADOW_FEED_COST).toBe(600);
    expect(SHADOW_FEED_DAYS).toBe(3);
  });
});

describe("cosmetic pricing", () => {
  it("prices the three skins and three frames on the ladder the Store lists", () => {
    expect(SHADOW_SKIN_COST).toEqual({ ember: 300, frost: 600, void: 1_000 });
    expect(TITLE_FRAME_COST).toEqual({
      system: 500,
      monarch: 1_200,
      sovereign: 2_500,
    });
    expect(DASHBOARD_LAYOUT_COST).toBe(500);
  });

  it("the fixed catalog — everything except the aura — totals 21,800 G", () => {
    // Nine shadows can each own each skin, and each frame is bought once.
    // This number is the whole finite side of the cosmetic sink; if a price
    // moves, this assertion is the one place that says so out loud.
    const skins = Object.values(SHADOW_SKIN_COST).reduce((a, b) => a + b, 0);
    const frames = Object.values(TITLE_FRAME_COST).reduce((a, b) => a + b, 0);
    expect(DASHBOARD_LAYOUT_COST + skins * 9 + frames).toBe(21_800);
  });

  it("the aura escalates by half again per purchase and saturates visually at five", () => {
    expect(AURA_BASE_COST).toBe(3_000);
    expect(AURA_COST_GROWTH).toBe(1.5);
    expect(AURA_VISUAL_MAX_LEVEL).toBe(5);
  });
});
