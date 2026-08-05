import { describe, it, expect } from "vitest";
import { systemClock, fixedClock } from "./system-clock";

describe("systemClock", () => {
  it("returns a time close to Date.now()", () => {
    const before = Date.now();
    const t = systemClock.now();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

describe("fixedClock", () => {
  it("always returns the same instant", () => {
    const clock = fixedClock("2026-08-05T16:59:00Z");
    expect(clock.now()).toBe(Date.parse("2026-08-05T16:59:00Z"));
    expect(clock.now()).toBe(clock.now());
  });

  it("throws on an invalid ISO string", () => {
    expect(() => fixedClock("not-a-date")).toThrow(/invalid ISO string/);
  });
});
