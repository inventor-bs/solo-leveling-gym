import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Guards against duplicate processing. Gym wifi is flaky, the user taps
 * again — EXP must not be granted twice.
 *
 * The client generates a clientActionId (UUID) for every mutation.
 * A second call with the same id returns the first call's result.
 */
export const processedAction = sqliteTable("processed_action", {
  id: text("id").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type ProcessedActionRow = typeof processedAction.$inferSelect;
