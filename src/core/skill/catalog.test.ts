import { describe, it, expect } from "vitest";
import { SKILL_CATALOG, skillById, isSkillId } from "./catalog";

describe("SKILL_CATALOG", () => {
  it("has exactly 13 skills across the three branches", () => {
    expect(SKILL_CATALOG).toHaveLength(13);
    expect(SKILL_CATALOG.filter((s) => s.branch === "body")).toHaveLength(4);
    expect(SKILL_CATALOG.filter((s) => s.branch === "shadow")).toHaveLength(4);
    expect(SKILL_CATALOG.filter((s) => s.branch === "sovereign")).toHaveLength(5);
  });

  it("every id is unique", () => {
    const ids = SKILL_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("skillById finds a known skill and returns null for an unknown one", () => {
    expect(skillById("tenacity")?.name).toBe("Tenacity");
    expect(skillById("not-a-skill")).toBeNull();
  });

  it("isSkillId narrows correctly", () => {
    expect(isSkillId("vital-strike")).toBe(true);
    expect(isSkillId("bogus")).toBe(false);
  });
});
