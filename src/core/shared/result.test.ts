import { describe, it, expect } from "vitest";
import { ok, err, isOk, unwrapOr } from "./result";

describe("Result", () => {
  it("ok() gói giá trị thành công", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r) && r.value).toBe(42);
  });

  it("err() gói lỗi", () => {
    const r = err("BOOM");
    expect(r.ok).toBe(false);
    expect(isOk(r)).toBe(false);
  });

  it("unwrapOr trả giá trị khi ok", () => {
    expect(unwrapOr(ok(10), 0)).toBe(10);
  });

  it("unwrapOr trả fallback khi err", () => {
    expect(unwrapOr(err<string>("nope"), 0)).toBe(0);
  });
});
