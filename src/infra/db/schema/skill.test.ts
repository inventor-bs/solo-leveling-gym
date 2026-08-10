import { describe, it, expect } from "vitest";
import { hunterSkill, skillSlotUnlock, SKILL_SLOT_UNLOCK_ID } from "./skill";

describe("skill schema", () => {
  it("hunterSkill has the expected columns", () => {
    expect(Object.keys(hunterSkill)).toEqual(
      expect.arrayContaining(["skillId", "learnedAt", "equippedAt"]),
    );
  });

  it("skillSlotUnlock's singleton id is a stable constant", () => {
    expect(SKILL_SLOT_UNLOCK_ID).toBe("singleton");
    expect(Object.keys(skillSlotUnlock)).toEqual(
      expect.arrayContaining(["id", "slotsPurchased"]),
    );
  });
});
