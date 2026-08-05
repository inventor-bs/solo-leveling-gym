import { describe, it, expect } from "vitest";
import { kg, reps, exp, gold, epoch } from "./units";

describe("branded units", () => {
  it("giữ nguyên giá trị số lúc runtime", () => {
    expect(kg(82.5)).toBe(82.5);
    expect(reps(6)).toBe(6);
    expect(exp(450)).toBe(450);
    expect(gold(1247)).toBe(1247);
    expect(epoch(1754400000000)).toBe(1754400000000);
  });

  it("cộng được như số bình thường", () => {
    const total = kg(80) + kg(2.5);
    expect(total).toBe(82.5);
  });
});
