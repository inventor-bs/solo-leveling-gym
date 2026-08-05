import { describe, it, expect } from "vitest";
import { signSession, verifySession, checkPin } from "./session";

const SECRET = "s".repeat(32);
const NOW = 1754400000000;

describe("signSession / verifySession", () => {
  it("a freshly signed token verifies successfully", () => {
    const token = signSession(NOW + 1000, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(true);
  });

  it("an expired token is rejected", () => {
    const token = signSession(NOW - 1, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("a token with a tampered signature is rejected", () => {
    const token = signSession(NOW + 1000, SECRET);
    const [expiresAt] = token.split(".");
    expect(verifySession(`${expiresAt}.deadbeef`, SECRET, NOW)).toBe(false);
  });

  it("REGRESSION: a token with a tampered expiry is rejected", () => {
    // An attacker takes a valid token and extends its expiry. The signature must block this.
    const token = signSession(NOW + 1000, SECRET);
    const [, sig] = token.split(".");
    expect(verifySession(`${NOW + 999999}.${sig}`, SECRET, NOW)).toBe(false);
  });

  it("a token signed with a different secret is rejected", () => {
    const token = signSession(NOW + 1000, "x".repeat(32));
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("garbage strings are rejected without throwing", () => {
    expect(verifySession("not-a-token", SECRET, NOW)).toBe(false);
    expect(verifySession("", SECRET, NOW)).toBe(false);
    expect(verifySession("a.b.c", SECRET, NOW)).toBe(false);
    expect(verifySession("not-a-number.abcd", SECRET, NOW)).toBe(false);
  });
});

describe("checkPin", () => {
  it("a correct PIN returns true", () => {
    expect(checkPin("1234", "1234")).toBe(true);
  });

  it("an incorrect PIN returns false", () => {
    expect(checkPin("9999", "1234")).toBe(false);
  });

  it("a PIN of different length returns false without throwing", () => {
    expect(checkPin("12", "1234")).toBe(false);
    expect(checkPin("123456", "1234")).toBe(false);
    expect(checkPin("", "1234")).toBe(false);
  });
});
