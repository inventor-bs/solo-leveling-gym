import { describe, it, expect } from "vitest";
import {
  dungeonRankFor,
  goldForDungeonRank,
  expForDungeonRank,
} from "./dungeon-rank";

describe("dungeonRankFor", () => {
  it("below 0.5x the average is E", () => {
    expect(dungeonRankFor(4000, 10000)).toBe("E");
  });

  it("0.5–0.8x is D", () => {
    expect(dungeonRankFor(5000, 10000)).toBe("D");
    expect(dungeonRankFor(7900, 10000)).toBe("D");
  });

  it("0.8–1.1x is C", () => {
    expect(dungeonRankFor(8000, 10000)).toBe("C");
    expect(dungeonRankFor(10900, 10000)).toBe("C");
  });

  it("1.1–1.4x is B", () => {
    expect(dungeonRankFor(11000, 10000)).toBe("B");
    expect(dungeonRankFor(13900, 10000)).toBe("B");
  });

  it("above 1.4x is A", () => {
    expect(dungeonRankFor(14000, 10000)).toBe("A");
    expect(dungeonRankFor(30000, 10000)).toBe("A");
  });

  it("with no history yet, defaults to C", () => {
    expect(dungeonRankFor(10000, 0)).toBe("C");
  });

  it("REGRESSION: as the hunter gets stronger, the same session's rank drops", () => {
    // Same 11000 session, average rises from 10000 to 14000
    expect(dungeonRankFor(11000, 10000)).toBe("B");
    expect(dungeonRankFor(11000, 14000)).toBe("D");
  });
});

describe("goldForDungeonRank", () => {
  it("gold increases with rank", () => {
    expect(goldForDungeonRank("E")).toBe(30);
    expect(goldForDungeonRank("D")).toBe(50);
    expect(goldForDungeonRank("C")).toBe(70);
    expect(goldForDungeonRank("B")).toBe(95);
    expect(goldForDungeonRank("A")).toBe(120);
  });
});

describe("expForDungeonRank", () => {
  it("EXP increases with rank, same ordering as gold", () => {
    expect(expForDungeonRank("E")).toBe(150);
    expect(expForDungeonRank("D")).toBe(250);
    expect(expForDungeonRank("C")).toBe(350);
    expect(expForDungeonRank("B")).toBe(475);
    expect(expForDungeonRank("A")).toBe(600);
  });

  it("every rank's EXP is a multiple of its gold value's ratio (5x)", () => {
    for (const rank of ["E", "D", "C", "B", "A"] as const) {
      expect(expForDungeonRank(rank)).toBe(goldForDungeonRank(rank) * 5);
    }
  });
});
