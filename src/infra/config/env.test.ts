import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  TURSO_DATABASE_URL: "file:./local.db",
  HUNTER_PIN: "1234",
  SESSION_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("chấp nhận env hợp lệ tối thiểu", () => {
    const env = parseEnv(valid);
    expect(env.TURSO_DATABASE_URL).toBe("file:./local.db");
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(420);
  });

  it("ép kiểu offset múi giờ về number", () => {
    const env = parseEnv({ ...valid, HUNTER_TZ_OFFSET_MINUTES: "0" });
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(0);
  });

  it("báo lỗi khi thiếu TURSO_DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, TURSO_DATABASE_URL: undefined })).toThrow(
      /TURSO_DATABASE_URL/,
    );
  });

  it("báo lỗi khi PIN ngắn hơn 4 ký tự", () => {
    expect(() => parseEnv({ ...valid, HUNTER_PIN: "12" })).toThrow(/HUNTER_PIN/);
  });

  it("báo lỗi khi SESSION_SECRET ngắn hơn 32 ký tự", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("GEMINI_API_KEY là tuỳ chọn", () => {
    expect(parseEnv(valid).GEMINI_API_KEY).toBeUndefined();
  });

  it("gom nhiều lỗi vào một thông báo", () => {
    expect(() =>
      parseEnv({ TURSO_DATABASE_URL: undefined, HUNTER_PIN: "1" }),
    ).toThrow(/TURSO_DATABASE_URL[\s\S]*HUNTER_PIN|HUNTER_PIN[\s\S]*SESSION_SECRET/);
  });
});
