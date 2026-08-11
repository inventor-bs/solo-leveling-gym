import { describe, it, expect } from "vitest";
import { armyRank, type ShadowStanding } from "./army-rank";

function standing(
  grade: ShadowStanding["grade"],
  extracted = true,
  countsTowardArmy = true,
): ShadowStanding {
  return { grade, extracted, countsTowardArmy };
}

describe("armyRank", () => {
  it("is null when nothing has been extracted yet", () => {
    expect(armyRank([standing("Normal", false)])).toBeNull();
  });

  it("is the sole extracted shadow's grade with only one contributor", () => {
    expect(armyRank([standing("Elite")])).toBe("Elite");
  });

  it("REGRESSION: is gated by the weakest extracted shadow, not an average or the strongest", () => {
    const standings = [
      standing("Grand Marshal"),
      standing("Commander"),
      standing("Normal"),
    ];
    expect(armyRank(standings)).toBe("Normal");
  });

  it("ignores shadows that have not been extracted yet", () => {
    const standings = [standing("Marshal"), standing("Normal", false)];
    expect(armyRank(standings)).toBe("Marshal");
  });

  it("ignores shadows marked as not counting toward the army, such as Bellion", () => {
    const standings = [
      standing("Elite"),
      standing("Grand Marshal", true, false),
    ];
    expect(armyRank(standings)).toBe("Elite");
  });

  it("average mode returns the mean grade, rounded, instead of the weakest", () => {
    const standings = [
      standing("Knight"), // rank 3
      standing("Elite"), // rank 2
      standing("Marshal"), // rank 4
    ];
    // weakest: Elite. average: (3+2+4)/3 = 3 -> Knight.
    expect(armyRank(standings, "weakest")).toBe("Elite");
    expect(armyRank(standings, "average")).toBe("Knight");
  });
});
