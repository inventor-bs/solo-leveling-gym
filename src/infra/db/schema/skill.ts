import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per skill in the catalog, seeded up front — same shape as
 * `title`. `learnedAt` is permanent and one-way (AP already spent).
 * `equippedAt` is revocable: a learned skill with a null `equippedAt` is
 * owned but inert, the same way an earned-but-unworn title does nothing.
 * Capacity (how many rows may have a non-null equippedAt at once) is
 * enforced by the app-service, not by this schema.
 */
export const hunterSkill = sqliteTable("hunter_skill", {
  skillId: text("skill_id").primaryKey(),
  learnedAt: integer("learned_at"),
  equippedAt: integer("equipped_at"),
});

export type HunterSkillRow = typeof hunterSkill.$inferSelect;

/**
 * How many Rune Stones have been bought, ever. Slot capacity is
 * `SKILL_SLOTS_BASE + slotsPurchased`, capped at `SKILL_SLOTS_MAX` by the
 * app-service before it lets a purchase through — the same one-way-counter
 * shape as `demonCastleProgress.highestFloorCleared`.
 */
export const skillSlotUnlock = sqliteTable("skill_slot_unlock", {
  id: text("id").primaryKey(),
  slotsPurchased: integer("slots_purchased").notNull().default(0),
});

export type SkillSlotUnlockRow = typeof skillSlotUnlock.$inferSelect;

export const SKILL_SLOT_UNLOCK_ID = "singleton";
