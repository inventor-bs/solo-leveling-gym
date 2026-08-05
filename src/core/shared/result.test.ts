import { describe, it, expect } from "vitest";
import { ok, err, isOk, unwrapOr } from "./result";

describe("Result", () => {
  it("wraps a success value with ok()", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r) && r.value).toBe(42);
  });

  it("wraps an error with err()", () => {
    const r = err("BOOM");
    expect(r.ok).toBe(false);
    expect(isOk(r)).toBe(false);
  });

  it("unwrapOr returns the value when ok", () => {
    expect(unwrapOr(ok(10), 0)).toBe(10);
  });

  it("unwrapOr returns the fallback when err", () => {
    expect(unwrapOr(err<string>("nope"), 0)).toBe(0);
  });
});
