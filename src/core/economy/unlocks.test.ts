import { describe, it, expect } from "vitest";
import { MUSCLE_GROUPS } from "@/core/training/types";
import {
  UNLOCK_CATALOG,
  unlockByKey,
  programUnlockKey,
  exerciseUnlockKey,
  dungeonTypeUnlockKey,
  meetsRequirement,
  DUNGEON_TYPE_UNLOCK_IDS,
} from "./unlocks";

describe("unlock keys", () => {
  it("namespaces every key by what it unlocks", () => {
    expect(programUnlockKey("ppl")).toBe("program:ppl");
    expect(programUnlockKey("531")).toBe("program:531");
    expect(programUnlockKey("arnold")).toBe("program:arnold");
    expect(exerciseUnlockKey("back")).toBe("exercise:back");
    expect(dungeonTypeUnlockKey("amrap")).toBe("dungeon-type:amrap");
    expect(dungeonTypeUnlockKey("emom")).toBe("dungeon-type:emom");
    expect(dungeonTypeUnlockKey("dropset")).toBe("dungeon-type:dropset");
  });
});

describe("UNLOCK_CATALOG", () => {
  it("has no duplicate keys", () => {
    const keys = UNLOCK_CATALOG.map((u) => u.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers three programs, one exercise unlock per muscle group, and three dungeon types", () => {
    expect(UNLOCK_CATALOG).toHaveLength(3 + MUSCLE_GROUPS.length + 3);
  });

  it("DUNGEON_TYPE_UNLOCK_IDS matches every dungeon-type entry actually in the catalog", () => {
    const fromCatalog = UNLOCK_CATALOG.filter((u) =>
      u.key.startsWith("dungeon-type:"),
    ).map((u) => u.key);
    expect(DUNGEON_TYPE_UNLOCK_IDS.map(dungeonTypeUnlockKey)).toEqual(
      fromCatalog,
    );
  });

  it("prices and gates the three programs by level", () => {
    expect(unlockByKey("program:ppl")).toMatchObject({
      cost: 3_000,
      requirement: { kind: "level", minLevel: 20 },
    });
    expect(unlockByKey("program:531")).toMatchObject({
      cost: 5_000,
      requirement: { kind: "level", minLevel: 30 },
    });
    expect(unlockByKey("program:arnold")).toMatchObject({
      cost: 6_000,
      requirement: { kind: "level", minLevel: 35 },
    });
  });

  it("prices every exercise unlock at 400 behind an Army Rank gate", () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(unlockByKey(exerciseUnlockKey(muscle))).toMatchObject({
        cost: 400,
        requirement: { kind: "army-rank", minGrade: "Elite" },
      });
    }
  });

  it("prices every dungeon type at 1200 with no gate but the gold", () => {
    for (const id of ["amrap", "emom", "dropset"] as const) {
      expect(unlockByKey(dungeonTypeUnlockKey(id))).toMatchObject({
        cost: 1_200,
        requirement: { kind: "none" },
      });
    }
  });

  it("returns null for a key that is not in the catalog", () => {
    expect(unlockByKey("program:starting-strength")).toBeNull();
    expect(unlockByKey("exercise:eyebrows")).toBeNull();
  });
});

describe("meetsRequirement", () => {
  it("always passes an ungated unlock", () => {
    expect(
      meetsRequirement({ kind: "none" }, { level: 1, armyRank: null }),
    ).toBe(true);
  });

  it("passes a level gate at and above the threshold", () => {
    const req = { kind: "level", minLevel: 20 } as const;
    expect(meetsRequirement(req, { level: 19, armyRank: null })).toBe(false);
    expect(meetsRequirement(req, { level: 20, armyRank: null })).toBe(true);
    expect(meetsRequirement(req, { level: 55, armyRank: null })).toBe(true);
  });

  it("passes an Army Rank gate at and above the named grade", () => {
    const req = { kind: "army-rank", minGrade: "Elite" } as const;
    expect(meetsRequirement(req, { level: 99, armyRank: null })).toBe(false);
    expect(meetsRequirement(req, { level: 99, armyRank: "Normal" })).toBe(
      false,
    );
    expect(meetsRequirement(req, { level: 1, armyRank: "Elite" })).toBe(true);
    expect(meetsRequirement(req, { level: 1, armyRank: "Marshal" })).toBe(true);
  });
});
