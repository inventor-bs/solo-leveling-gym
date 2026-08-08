import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per narrative fragment the hunter has unlocked. A row's EXISTENCE
 * is the unlock — there is no `locked` state and no seed step, because a
 * locked fragment has nothing to show. The Archive renders the rows it finds
 * and a count of how many of the catalog's fragments are still sealed.
 *
 * Deliberately stores no prose. The text of every fragment is a constant in
 * the narrative catalog, so fixing a typo is a commit rather than a
 * migration, and two databases can never disagree about what a fragment says.
 *
 * `ordinal` is the fragment's position in that catalog, copied here so the
 * Archive can order rows without loading the catalog into a query.
 */
export const narrativeFragment = sqliteTable("narrative_fragment", {
  id: text("id").primaryKey(),
  ordinal: integer("ordinal").notNull(),
  unlockedDay: text("unlocked_day").notNull(),
  unlockedAt: integer("unlocked_at").notNull(),
});

export type NarrativeFragmentRow = typeof narrativeFragment.$inferSelect;
