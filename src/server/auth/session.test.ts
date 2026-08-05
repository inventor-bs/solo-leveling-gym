import { describe, it, expect } from "vitest";
import { signSession, verifySession, checkPin } from "./session";

const SECRET = "s".repeat(32);
const NOW = 1754400000000;

describe("signSession / verifySession", () => {
  it("token vừa ký thì xác thực thành công", () => {
    const token = signSession(NOW + 1000, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(true);
  });

  it("token hết hạn bị từ chối", () => {
    const token = signSession(NOW - 1, SECRET);
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("token bị sửa chữ ký bị từ chối", () => {
    const token = signSession(NOW + 1000, SECRET);
    const [expiresAt] = token.split(".");
    expect(verifySession(`${expiresAt}.deadbeef`, SECRET, NOW)).toBe(false);
  });

  it("REGRESSION: token bị sửa hạn dùng bị từ chối", () => {
    // Kẻ tấn công lấy token hợp lệ rồi kéo dài hạn. Chữ ký phải chặn.
    const token = signSession(NOW + 1000, SECRET);
    const [, sig] = token.split(".");
    expect(verifySession(`${NOW + 999999}.${sig}`, SECRET, NOW)).toBe(false);
  });

  it("token ký bằng secret khác bị từ chối", () => {
    const token = signSession(NOW + 1000, "x".repeat(32));
    expect(verifySession(token, SECRET, NOW)).toBe(false);
  });

  it("chuỗi rác bị từ chối, không ném lỗi", () => {
    expect(verifySession("khong-phai-token", SECRET, NOW)).toBe(false);
    expect(verifySession("", SECRET, NOW)).toBe(false);
    expect(verifySession("a.b.c", SECRET, NOW)).toBe(false);
    expect(verifySession("khong-phai-so.abcd", SECRET, NOW)).toBe(false);
  });
});

describe("checkPin", () => {
  it("PIN đúng trả true", () => {
    expect(checkPin("1234", "1234")).toBe(true);
  });

  it("PIN sai trả false", () => {
    expect(checkPin("9999", "1234")).toBe(false);
  });

  it("PIN khác độ dài trả false, không ném lỗi", () => {
    expect(checkPin("12", "1234")).toBe(false);
    expect(checkPin("123456", "1234")).toBe(false);
    expect(checkPin("", "1234")).toBe(false);
  });
});
