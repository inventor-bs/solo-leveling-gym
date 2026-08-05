import { describe, it, expect } from "vitest";
import { seededRng } from "./seeded-rng";

describe("seededRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = seededRng(1234);
    const b = seededRng(1234);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next() always stays within [0, 1)", () => {
    const rng = seededRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() always stays within [min, max)", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("int() throws when max <= min", () => {
    const rng = seededRng(1);
    expect(() => rng.int(10, 10)).toThrow(/must be greater than/);
    expect(() => rng.int(10, 5)).toThrow(/must be greater than/);
  });
});
