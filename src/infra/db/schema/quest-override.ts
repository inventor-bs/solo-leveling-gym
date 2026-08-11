import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * At most one override per day — the primary key is the day itself, so a
 * second attempt on the same day collides rather than needing an
 * application-level count. `previousValue` exists purely so a future
 * timeline view can explain what changed; nothing reads it back to undo
 * the swap.
 */
export const questOverride = sqliteTable("quest_override", {
  day: text("day").primaryKey(),
  field: text("field").notNull(),
  previousValue: real("previous_value").notNull(),
  newValue: real("new_value").notNull(),
  appliedAt: integer("applied_at").notNull(),
});

export type QuestOverrideRow = typeof questOverride.$inferSelect;
