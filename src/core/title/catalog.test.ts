import { describe, it, expect } from "vitest";
import {
  TITLE_CATALOG,
  titleById,
  isTitleId,
  UNYIELDING_STREAK_DAYS,
  MONARCH_MORNING_SESSIONS,
  MORNING_BEFORE_HOUR,
  RETURNED_PENALTY_EXITS,
} from "./catalog";

describe("TITLE_CATALOG", () => {
  it("holds exactly the three implementable titles", () => {
    expect(TITLE_CATALOG.map((t) => t.id)).toEqual([
      "unyielding",
      "monarch-of-dawn",
      "one-who-returned",
    ]);
  });

  it("gives every title a name, a condition, and a buff the page can print", () => {
    for (const t of TITLE_CATALOG) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.condition.length).toBeGreaterThan(0);
      expect(t.buff.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = new Set(TITLE_CATALOG.map((t) => t.id));
    expect(ids.size).toBe(TITLE_CATALOG.length);
  });
});

describe("titleById", () => {
  it("finds a known title", () => {
    expect(titleById("unyielding")?.name).toBe("Unyielding");
  });

  it("returns null for anything else, rather than throwing", () => {
    expect(titleById("wolfs-nemesis")).toBeNull();
    expect(titleById("")).toBeNull();
  });
});

describe("isTitleId", () => {
  it("accepts every catalogued id", () => {
    for (const t of TITLE_CATALOG) expect(isTitleId(t.id)).toBe(true);
  });

  it("REGRESSION: rejects a value that merely looks like an id", () => {
    // hunter.title is a plain nullable text column, so a hand-edited or
    // stale row can hold anything at all. Nothing downstream may trust it.
    expect(isTitleId("Unyielding")).toBe(false);
    expect(isTitleId("wolfs-nemesis")).toBe(false);
  });
});

describe("earning thresholds", () => {
  it("matches the published conditions", () => {
    expect(UNYIELDING_STREAK_DAYS).toBe(30);
    expect(MONARCH_MORNING_SESSIONS).toBe(10);
    expect(MORNING_BEFORE_HOUR).toBe(7);
    expect(RETURNED_PENALTY_EXITS).toBe(5);
  });
});
