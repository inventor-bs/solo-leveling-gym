import { describe, it, expect } from "vitest";
import type { MuscleGroup } from "@/core/training/types";
import { SHADOW_ROSTER, shadowForMuscle, CARDIO_EXP_PER_KM } from "./roster";

describe("SHADOW_ROSTER", () => {
  it("has exactly nine shadows", () => {
    expect(SHADOW_ROSTER).toHaveLength(9);
  });

  it("maps every non-cardio muscle group to exactly one shadow", () => {
    const muscleGroups: MuscleGroup[] = [
      "chest",
      "back",
      "quads",
      "posterior",
      "shoulders",
      "arms",
      "core",
      "cardio",
    ];
    for (const muscle of muscleGroups) {
      const matches = SHADOW_ROSTER.filter((s) => s.muscle === muscle);
      expect(matches).toHaveLength(1);
    }
  });

  it("gives Bellion no muscle group — it is not extracted from lifting", () => {
    const bellion = SHADOW_ROSTER.find((s) => s.id === "bellion");
    expect(bellion?.muscle).toBeNull();
  });

  it("REGRESSION: Igris is the only shadow marked pre-extracted", () => {
    const preExtracted = SHADOW_ROSTER.filter((s) => s.startsExtracted);
    expect(preExtracted.map((s) => s.id)).toEqual(["igris"]);
  });

  it("names Igris for chest, matching the source material", () => {
    expect(SHADOW_ROSTER.find((s) => s.muscle === "chest")?.id).toBe("igris");
  });
});

describe("shadowForMuscle", () => {
  it("finds the right shadow for every lifting muscle group", () => {
    expect(shadowForMuscle("chest")).toBe("igris");
    expect(shadowForMuscle("back")).toBe("tank");
    expect(shadowForMuscle("quads")).toBe("iron");
    expect(shadowForMuscle("posterior")).toBe("beru");
    expect(shadowForMuscle("shoulders")).toBe("greed");
    expect(shadowForMuscle("arms")).toBe("jima");
    expect(shadowForMuscle("core")).toBe("tusk");
    expect(shadowForMuscle("cardio")).toBe("kaisel");
  });
});

describe("CARDIO_EXP_PER_KM", () => {
  it("is a positive constant", () => {
    expect(CARDIO_EXP_PER_KM).toBeGreaterThan(0);
  });
});
