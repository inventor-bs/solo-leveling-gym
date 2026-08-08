import { describe, it, expect } from "vitest";
import { moderateDraft } from "./moderation";
import type { VoiceDraft } from "@/ports/system-voice.port";

function draft(patch: Partial<VoiceDraft> = {}): VoiceDraft {
  return {
    body: "Hunter. Bench press: 82.5 kg. Do not let this be the last time.",
    severity: "info",
    title: null,
    ...patch,
  };
}

function moderate(d: VoiceDraft, allowed: number[] = [82.5]) {
  return moderateDraft({
    draft: d,
    allowedNumbers: allowed,
    forbiddenText: ["Jin-Woo"],
  });
}

describe("moderateDraft", () => {
  it("passes a message that obeys every rule", () => {
    const result = moderate(draft());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.body).toContain("82.5");
      expect(result.value.severity).toBe("info");
    }
  });

  it("rejects an empty body", () => {
    const result = moderate(draft({ body: "   " }));
    expect(result).toEqual({ ok: false, error: { type: "empty" } });
  });

  it("REGRESSION: rejects a number the context never contained", () => {
    // The whole point of this gate: The System must never claim a deadlift
    // of 140 kg from someone who has not touched 100.
    const result = moderate(
      draft({ body: "Hunter. Deadlift: 140 kg. Take it back." }),
      [82.5],
    );
    expect(result).toEqual({
      ok: false,
      error: { type: "hallucinated-number", value: 140 },
    });
  });

  it("accepts a number that differs only in formatting", () => {
    const result = moderate(
      draft({ body: "Hunter. Bench press: 82.50 kg. Continue." }),
      [82.5],
    );
    expect(result.ok).toBe(true);
  });

  it("rejects markup outright rather than trying to clean it", () => {
    const result = moderate(
      draft({ body: "Hunter. <b>Train</b> today. Continue." }),
    );
    expect(result).toEqual({ ok: false, error: { type: "markup" } });
  });

  it("strips markdown emphasis quietly", () => {
    const result = moderate(
      draft({ body: "Hunter. **Train** today. Continue." }),
      [],
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.body).toBe("Hunter. Train today. Continue.");
  });

  it("cuts a fourth sentence at the boundary instead of mid-clause", () => {
    const result = moderate(
      draft({
        body: "Hunter. One. Two. Three. Four.",
      }),
      [],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.body).toBe("Hunter. One. Two.");
  });

  it("rejects a message still too long after the cut", () => {
    const long = `Hunter ${"word ".repeat(60)}.`;
    const result = moderate(draft({ body: long }), []);
    expect(result).toEqual({ ok: false, error: { type: "too-long" } });
  });

  it("rejects more than one exclamation mark", () => {
    const result = moderate(draft({ body: "Hunter! Train! Now." }), []);
    expect(result).toEqual({ ok: false, error: { type: "voice-rule" } });
  });

  it("rejects emoji", () => {
    const result = moderate(draft({ body: "Hunter. Train today. 💪" }), []);
    expect(result).toEqual({ ok: false, error: { type: "voice-rule" } });
  });

  it("rejects a message that never addresses the Hunter", () => {
    const result = moderate(draft({ body: "Train today. Do not stop." }), []);
    expect(result).toEqual({ ok: false, error: { type: "voice-rule" } });
  });

  it("REGRESSION: rejects a message containing the hunter's real name", () => {
    const result = moderate(
      draft({ body: "Hunter Jin-Woo. Train today. Continue." }),
      [],
    );
    expect(result).toEqual({ ok: false, error: { type: "forbidden-text" } });
  });

  it("checks the title as strictly as the body", () => {
    const result = moderate(
      draft({ title: "Deadlift 140 kg", body: "Hunter. Continue. Now." }),
      [],
    );
    expect(result).toEqual({
      ok: false,
      error: { type: "hallucinated-number", value: 140 },
    });
  });
});
