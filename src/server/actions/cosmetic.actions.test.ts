import { describe, it, expect } from "vitest";
import { VOICE_TONE_CATALOG } from "@/core/system-voice/tone";
import { equipVoiceToneSchema } from "./cosmetic.schemas";

describe("equipVoiceToneSchema", () => {
  it("accepts exactly the tone ids VOICE_TONE_CATALOG defines", () => {
    const toneIdShape = equipVoiceToneSchema.shape.toneId.unwrap();
    expect(toneIdShape.options).toEqual(
      VOICE_TONE_CATALOG.map((tone) => tone.id),
    );
  });
});
