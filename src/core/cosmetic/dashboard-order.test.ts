import { describe, it, expect } from "vitest";
import { normalizeDashboardOrder } from "./dashboard-order";

const DEFAULTS = ["a", "b", "c", "d"] as const;

describe("normalizeDashboardOrder", () => {
  it("falls back to the defaults when nothing is stored", () => {
    expect(normalizeDashboardOrder(null, DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(normalizeDashboardOrder(undefined, DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(normalizeDashboardOrder("", DEFAULTS)).toEqual(["a", "b", "c", "d"]);
  });

  it("never throws on stored garbage — a bad row must not 500 the home page", () => {
    expect(normalizeDashboardOrder("{not json", DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(normalizeDashboardOrder('{"a":1}', DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(normalizeDashboardOrder("42", DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("keeps a full stored order exactly as stored", () => {
    expect(normalizeDashboardOrder('["d","c","b","a"]', DEFAULTS)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("drops ids that are no longer valid panels", () => {
    expect(normalizeDashboardOrder('["c","gone","a"]', DEFAULTS)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("drops non-string members without discarding the rest", () => {
    expect(normalizeDashboardOrder('["c",5,null,"a"]', DEFAULTS)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("keeps the first occurrence of a duplicated id", () => {
    expect(normalizeDashboardOrder('["c","a","c","b"]', DEFAULTS)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("appends a newly added panel at the end, in default order", () => {
    // A panel introduced in a later phase appears without a migration.
    expect(normalizeDashboardOrder('["b","a"]', DEFAULTS)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("returns the defaults for an empty stored array", () => {
    expect(normalizeDashboardOrder("[]", DEFAULTS)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("returns a fresh array rather than the caller's defaults", () => {
    const result = normalizeDashboardOrder(null, DEFAULTS);
    expect(result).not.toBe(DEFAULTS);
  });
});
