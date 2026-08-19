import { describe, it, expect, vi } from "vitest";
import { VOICE_TONE_CATALOG } from "@/core/system-voice/tone";

// cosmetic.actions.ts pulls in next/headers and the DB container at module
// scope (through the auth guard and getContainer imports), so it needs the
// same stubs as every other actions test file even though this test never
// calls an action or touches auth/DB itself.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: vi.fn() }),
}));
vi.mock("@/infra/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "s".repeat(32) }),
}));

const { equipVoiceToneSchema } = await import("./cosmetic.actions");

describe("equipVoiceToneSchema", () => {
  it("accepts exactly the tone ids VOICE_TONE_CATALOG defines", () => {
    const toneIdShape = equipVoiceToneSchema.shape.toneId.unwrap();
    expect(toneIdShape.options).toEqual(
      VOICE_TONE_CATALOG.map((tone) => tone.id),
    );
  });
});
