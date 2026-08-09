import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export type WagerStatus = "active" | "won" | "lost";

/**
 * One row per week the hunter staked gold on their own training.
 *
 * `weekStart` is the TrainingDay of that week's Monday and is the primary
 * key, which is what makes "one wager per week" a property of the schema
 * rather than a check someone has to remember. The stake is deducted at
 * placement, so `status` only ever decides whether a payout is credited —
 * a loss costs nothing further.
 *
 * `resolvedAt` null means the week has not been judged yet.
 */
export const wager = sqliteTable("wager", {
  weekStart: text("week_start").primaryKey(),
  stakeGold: integer("stake_gold").notNull(),
  status: text("status").notNull().default("active"),
  placedAt: integer("placed_at").notNull(),
  resolvedAt: integer("resolved_at"),
});

export type WagerRow = typeof wager.$inferSelect;
