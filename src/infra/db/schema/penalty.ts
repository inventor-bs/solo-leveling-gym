import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per penalty episode. `endedAt` null means the hunter is still
 * inside it — that is the single source of truth for "is a penalty active",
 * so there is no boolean to drift out of sync with the timestamps.
 *
 * `expLost` is recorded because the EXP deduction is permanent: without it
 * the history could not explain where the points went.
 */
export const penalty = sqliteTable("penalty", {
  id: text("id").primaryKey(),
  startedDay: text("started_day").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  reason: text("reason").notNull(),
  variantId: integer("variant_id").notNull(),
  expLost: integer("exp_lost").notNull(),
});

export type PenaltyRow = typeof penalty.$inferSelect;
