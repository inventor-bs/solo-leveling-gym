import { describe, it, expect } from "vitest";
import { penaltyVariantFor, PENALTY_VARIANTS } from "./variants";

describe("penaltyVariantFor", () => {
  it("opens the first penalty in the desert", () => {
    expect(penaltyVariantFor(0).id).toBe(1);
    expect(penaltyVariantFor(0).setting.toLowerCase()).toContain("desert");
  });

  it("gives each of the first four penalties a distinct setting", () => {
    const settings = [0, 1, 2, 3].map((n) => penaltyVariantFor(n).setting);
    expect(new Set(settings).size).toBe(4);
  });

  it("cycles from the fifth penalty onward", () => {
    expect(penaltyVariantFor(4).id).toBe(penaltyVariantFor(0).id);
    expect(penaltyVariantFor(9).id).toBe(penaltyVariantFor(1).id);
  });

  it("treats a negative count as the first penalty rather than crashing", () => {
    expect(penaltyVariantFor(-1).id).toBe(1);
  });

  it("REGRESSION: every variant carries copy, so no screen can render blank", () => {
    for (const v of PENALTY_VARIANTS) {
      expect(v.setting.length).toBeGreaterThan(0);
      expect(v.openingLine.length).toBeGreaterThan(0);
      expect(v.tone.length).toBeGreaterThan(0);
    }
  });

  it("never addresses the hunter by name, per the voice rules", () => {
    for (const v of PENALTY_VARIANTS) {
      expect(v.openingLine).toMatch(/Hunter|You/);
    }
  });
});
