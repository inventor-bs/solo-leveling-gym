import { describe, it, expect } from "vitest";
import {
  COLD_VOICE,
  VOICE_OF_THE_RULER_UNLOCK_KEY,
  VOICE_TONE_CATALOG,
  isVoiceToneId,
} from "./tone";

describe("VOICE_TONE_CATALOG", () => {
  it("lists exactly the three tones that are bought, and not the free one", () => {
    expect(VOICE_TONE_CATALOG.map((tone) => tone.id)).toEqual([
      "mocking",
      "ancient",
      "merciless",
    ]);
  });

  it("gives every tone a name, a description and a sample line to read", () => {
    for (const tone of VOICE_TONE_CATALOG) {
      expect(tone.name.length).toBeGreaterThan(0);
      expect(tone.description.length).toBeGreaterThan(0);
      expect(tone.sample.length).toBeGreaterThan(0);
    }
  });

  it("keeps every sample within the discipline the copy itself must hold to", () => {
    // No emoji, at most one exclamation mark. The samples are the standard
    // the template variants are written against, so they hold the same line.
    for (const tone of [...VOICE_TONE_CATALOG, COLD_VOICE]) {
      expect(tone.sample).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(tone.sample.split("!").length - 1).toBeLessThanOrEqual(1);
    }
  });
});

describe("isVoiceToneId", () => {
  it("accepts the three real ids", () => {
    expect(isVoiceToneId("mocking")).toBe(true);
    expect(isVoiceToneId("ancient")).toBe(true);
    expect(isVoiceToneId("merciless")).toBe(true);
  });

  it("REGRESSION: rejects 'cold', which is the null state and never an id", () => {
    // Two spellings of one state is the bug this rejection exists to stop:
    // a stored NULL and a stored "cold" would both have to be handled at
    // every comparison from here on.
    expect(isVoiceToneId("cold")).toBe(false);
  });

  it("rejects near misses and junk without narrowing them", () => {
    expect(isVoiceToneId("")).toBe(false);
    expect(isVoiceToneId("COLD")).toBe(false);
    expect(isVoiceToneId("Mocking")).toBe(false);
    expect(isVoiceToneId("ruler")).toBe(false);
  });
});

describe("VOICE_OF_THE_RULER_UNLOCK_KEY", () => {
  it("is one key for the whole bundle, not one key per tone", () => {
    expect(VOICE_OF_THE_RULER_UNLOCK_KEY).toBe("voice:ruler");
    for (const tone of VOICE_TONE_CATALOG) {
      expect(VOICE_OF_THE_RULER_UNLOCK_KEY).not.toContain(tone.id);
    }
  });
});

describe("COLD_VOICE", () => {
  it("describes the default voice without giving it a purchasable identity", () => {
    expect(COLD_VOICE.name).toBe("Cold");
    expect(COLD_VOICE.sample).toContain("Hunter");
    expect(VOICE_TONE_CATALOG.map((t) => t.name)).not.toContain(
      COLD_VOICE.name,
    );
  });
});
