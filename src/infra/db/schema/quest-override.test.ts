import { describe, it, expect } from "vitest";
import { questOverride } from "./quest-override";

describe("quest_override schema", () => {
  it("is keyed by day", () => {
    expect(Object.keys(questOverride)).toEqual(
      expect.arrayContaining([
        "day",
        "field",
        "previousValue",
        "newValue",
        "appliedAt",
      ]),
    );
  });
});
