import { describe, it, expect } from "vitest";
import {
  maxStake,
  isStakeAllowed,
  wagerWon,
  wagerPayout,
  type WagerContract,
} from "./wager";

function contract(overrides: Partial<WagerContract> = {}): WagerContract {
  return {
    dungeonsCleared: 4,
    runsLogged: 2,
    dailyQuestsCompleted: 7,
    ...overrides,
  };
}

describe("maxStake", () => {
  it("is half the gold on hand, rounded down to a whole coin", () => {
    expect(maxStake(1_000)).toBe(500);
    expect(maxStake(999)).toBe(499);
  });

  it("is zero when there is nothing to stake", () => {
    expect(maxStake(0)).toBe(0);
    expect(maxStake(-100)).toBe(0);
  });
});

describe("isStakeAllowed", () => {
  it("allows a stake up to and including half the gold on hand", () => {
    expect(isStakeAllowed(500, 1_000)).toBe(true);
    expect(isStakeAllowed(1, 1_000)).toBe(true);
  });

  it("refuses a stake over the cap, at zero, or negative", () => {
    expect(isStakeAllowed(501, 1_000)).toBe(false);
    expect(isStakeAllowed(0, 1_000)).toBe(false);
    expect(isStakeAllowed(-50, 1_000)).toBe(false);
  });

  it("refuses a fractional stake — gold is whole coins", () => {
    expect(isStakeAllowed(100.5, 1_000)).toBe(false);
  });
});

describe("wagerWon", () => {
  it("wins only when all three targets are met", () => {
    expect(wagerWon(contract())).toBe(true);
  });

  it("wins when every target is exceeded", () => {
    expect(
      wagerWon(
        contract({
          dungeonsCleared: 6,
          runsLogged: 3,
          dailyQuestsCompleted: 7,
        }),
      ),
    ).toBe(true);
  });

  it("loses when any single target falls short", () => {
    expect(wagerWon(contract({ dungeonsCleared: 3 }))).toBe(false);
    expect(wagerWon(contract({ runsLogged: 1 }))).toBe(false);
    expect(wagerWon(contract({ dailyQuestsCompleted: 6 }))).toBe(false);
  });
});

describe("wagerPayout", () => {
  it("credits three times the stake", () => {
    expect(wagerPayout(250)).toBe(750);
  });

  it("nets twice the stake, since the stake was already deducted", () => {
    const stake = 250;
    expect(wagerPayout(stake) - stake).toBe(500);
  });
});
