import { describe, it, expect } from "vitest";
import {
  isChallengeType,
  redGateTargetVolume,
  demonCastleTargetVolume,
  volumeTargetMet,
  redGateRewardMultiplier,
  bossRaidGoldPerPr,
} from "./challenges";

describe("isChallengeType", () => {
  it("accepts the three real types and rejects anything else", () => {
    expect(isChallengeType("red-gate")).toBe(true);
    expect(isChallengeType("boss-raid")).toBe(true);
    expect(isChallengeType("demon-castle")).toBe(true);
    expect(isChallengeType("instant-dungeon-key")).toBe(false);
  });
});

describe("redGateTargetVolume", () => {
  it("asks for 1.5x the recent average", () => {
    expect(redGateTargetVolume(10_000)).toBeCloseTo(15_000, 6);
  });
});

describe("demonCastleTargetVolume", () => {
  it("adds 10% of the average per floor", () => {
    expect(demonCastleTargetVolume(10_000, 1)).toBeCloseTo(11_000, 6);
    expect(demonCastleTargetVolume(10_000, 5)).toBeCloseTo(15_000, 6);
  });
});

describe("volumeTargetMet", () => {
  it("clears when the session reaches the target", () => {
    expect(volumeTargetMet(15_000, 15_000, 10_000)).toBe(true);
    expect(volumeTargetMet(15_001, 15_000, 10_000)).toBe(true);
  });

  it("fails when the session falls short", () => {
    expect(volumeTargetMet(14_999, 15_000, 10_000)).toBe(false);
  });

  it("fails outright when there is no volume history to measure against", () => {
    // Without this, 1.5 * 0 = 0 and a single logged set would clear a Red
    // Gate on a fresh database. An unmeasurable target is not a cleared one.
    expect(volumeTargetMet(1, 0, 0)).toBe(false);
    expect(volumeTargetMet(50_000, 0, 0)).toBe(false);
  });
});

describe("reward multipliers", () => {
  it("quadruples gold and EXP only on a cleared Red Gate", () => {
    expect(redGateRewardMultiplier(true)).toBe(4);
    expect(redGateRewardMultiplier(false)).toBe(1);
  });

  it("pays 300 per PR inside a cleared Boss Raid, 150 otherwise", () => {
    expect(bossRaidGoldPerPr(true)).toBe(300);
    expect(bossRaidGoldPerPr(false)).toBe(150);
  });
});
