import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * At most one swap per ISO week — the primary key is the week's Monday,
 * the same week-identity convention already shared by `wager.week_start`
 * and the Perfect Week check. The base program schedule in `program_day`
 * is never touched; this row only shifts which weekday counts as
 * scheduled for the one week it names.
 */
export const weeklyScheduleSwap = sqliteTable("weekly_schedule_swap", {
  weekStart: text("week_start").primaryKey(),
  weekdayFrom: integer("weekday_from").notNull(),
  weekdayTo: integer("weekday_to").notNull(),
  swappedAt: integer("swapped_at").notNull(),
});

export type WeeklyScheduleSwapRow = typeof weeklyScheduleSwap.$inferSelect;
