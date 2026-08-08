import { describe, it, expect } from "vitest";
import { NARRATIVE_FRAGMENTS, fragmentById } from "./fragments";

describe("NARRATIVE_FRAGMENTS", () => {
  it("is a finite arc of exactly 15 fragments", () => {
    expect(NARRATIVE_FRAGMENTS).toHaveLength(15);
  });

  it("numbers its ordinals 1..15 in array order", () => {
    NARRATIVE_FRAGMENTS.forEach((f, i) => {
      expect(f.ordinal).toBe(i + 1);
    });
  });

  it("has no duplicate ids", () => {
    const ids = new Set(NARRATIVE_FRAGMENTS.map((f) => f.id));
    expect(ids.size).toBe(NARRATIVE_FRAGMENTS.length);
  });

  it("opens at day 7 and follows at day 14 — the two known drop-off cliffs", () => {
    expect(NARRATIVE_FRAGMENTS[0]?.milestone).toEqual({ kind: "day", days: 7 });
    expect(NARRATIVE_FRAGMENTS[1]?.milestone).toEqual({
      kind: "day",
      days: 14,
    });
  });

  it("ends at S-Rank with the arc's closing stage", () => {
    const last = NARRATIVE_FRAGMENTS[NARRATIVE_FRAGMENTS.length - 1];
    expect(last?.milestone).toEqual({ kind: "rank", rank: "S" });
    expect(last?.stage).toBe("closed");
  });

  it("never places two fragments on the same milestone", () => {
    const keys = NARRATIVE_FRAGMENTS.map((f) => JSON.stringify(f.milestone));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never moves an arc stage backwards as the arc advances", () => {
    const order = ["anomaly", "inquiry", "revelation", "closed"];
    let seen = -1;
    for (const f of NARRATIVE_FRAGMENTS) {
      const at = order.indexOf(f.stage);
      expect(at).toBeGreaterThanOrEqual(seen);
      seen = at;
    }
  });

  it("obeys the voice rules: at most 3 sentences, no emoji, at most one '!'", () => {
    for (const f of NARRATIVE_FRAGMENTS) {
      const sentences = f.body.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(3);
      expect(f.body.split("!").length - 1).toBeLessThanOrEqual(1);
      expect(f.body).toMatch(/^[\p{L}\p{N}\p{P}\p{Zs}]+$/u);
    }
  });

  it("makes no numeric claim that could be mistaken for a training stat", () => {
    for (const f of NARRATIVE_FRAGMENTS) {
      expect(f.body).not.toMatch(/\d/);
    }
  });

  it("looks a fragment up by id and returns null for an unknown one", () => {
    expect(fragmentById("first-anomaly")?.ordinal).toBe(1);
    expect(fragmentById("no-such-fragment")).toBeNull();
  });
});
