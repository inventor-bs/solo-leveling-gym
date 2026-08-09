import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * At most three rows, ever — one per slot, keyed by the slot itself.
 *
 * There is no item id and no name column because the slot IS the item:
 * weapon is always Knight Killer, armor is always Shadow Compression Gear,
 * accessory is always Hunter's Charm. What varies between drops is the
 * grade, which is what the effect scales on. Storing the name would let a
 * row disagree with the catalog that defines the effect.
 *
 * Nothing here is purchasable. A row only ever appears because a real
 * dungeon was cleared and the roll came up.
 */
export const equipment = sqliteTable("equipment", {
  slot: text("slot").primaryKey(),
  grade: text("grade").notNull(),
  droppedAt: integer("dropped_at").notNull(),
});

export type EquipmentRow = typeof equipment.$inferSelect;
