import { describe, it, expect } from "vitest";
import { systemClock, fixedClock } from "./system-clock";

describe("systemClock", () => {
  it("trả về thời điểm gần với Date.now()", () => {
    const before = Date.now();
    const t = systemClock.now();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});

describe("fixedClock", () => {
  it("luôn trả về đúng một thời điểm", () => {
    const clock = fixedClock("2026-08-05T16:59:00Z");
    expect(clock.now()).toBe(Date.parse("2026-08-05T16:59:00Z"));
    expect(clock.now()).toBe(clock.now());
  });

  it("ném lỗi khi chuỗi ISO không hợp lệ", () => {
    expect(() => fixedClock("khong-phai-ngay")).toThrow(/không hợp lệ/);
  });
});
