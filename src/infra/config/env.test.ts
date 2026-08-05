import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  TURSO_DATABASE_URL: "file:./local.db",
  HUNTER_PIN: "1234",
  SESSION_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("accepts a minimal valid env", () => {
    const env = parseEnv(valid);
    expect(env.TURSO_DATABASE_URL).toBe("file:./local.db");
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(420);
  });

  it("coerces the timezone offset to a number", () => {
    const env = parseEnv({ ...valid, HUNTER_TZ_OFFSET_MINUTES: "0" });
    expect(env.HUNTER_TZ_OFFSET_MINUTES).toBe(0);
  });

  it("errors when TURSO_DATABASE_URL is missing", () => {
    expect(() => parseEnv({ ...valid, TURSO_DATABASE_URL: undefined })).toThrow(
      /TURSO_DATABASE_URL/,
    );
  });

  it("errors when HUNTER_PIN is shorter than 4 characters", () => {
    expect(() => parseEnv({ ...valid, HUNTER_PIN: "12" })).toThrow(/HUNTER_PIN/);
  });

  it("errors when SESSION_SECRET is shorter than 32 characters", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("treats GEMINI_API_KEY as optional", () => {
    expect(parseEnv(valid).GEMINI_API_KEY).toBeUndefined();
  });

  it("collects multiple errors into a single message", () => {
    expect(() =>
      parseEnv({ TURSO_DATABASE_URL: undefined, HUNTER_PIN: "1" }),
    ).toThrow(/TURSO_DATABASE_URL[\s\S]*HUNTER_PIN|HUNTER_PIN[\s\S]*SESSION_SECRET/);
  });
});
