import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * A hidden quest becomes visible only once it is already complete, so a row
 * is written at the moment of reveal and never before. The existence of the
 * row IS the reveal — there is no seed step and no pending state, which is
 * exactly the semantics "hidden" requires.
 *
 * `goldAwarded` records what was actually paid, the same way penalty.expLost
 * records what was actually taken. It is computed once from real training
 * days and never recomputed, so a later balance change cannot retroactively
 * rewrite what the hunter was told they earned.
 */
export const hiddenQuest = sqliteTable("hidden_quest", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  revealedDay: text("revealed_day").notNull(),
  revealedAt: integer("revealed_at").notNull(),
  goldAwarded: integer("gold_awarded").notNull(),
});

export type HiddenQuestRow = typeof hiddenQuest.$inferSelect;
