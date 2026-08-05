import { describe, it, expect } from "vitest";
import { seededRng } from "./seeded-rng";

describe("seededRng", () => {
  it("cùng seed cho cùng chuỗi số", () => {
    const a = seededRng(1234);
    const b = seededRng(1234);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("seed khác cho chuỗi khác", () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next() luôn nằm trong [0, 1)", () => {
    const rng = seededRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() luôn nằm trong [min, max)", () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("int() ném lỗi khi max <= min", () => {
    const rng = seededRng(1);
    expect(() => rng.int(10, 10)).toThrow(/phải lớn hơn/);
    expect(() => rng.int(10, 5)).toThrow(/phải lớn hơn/);
  });
});
