import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export type QuestStatus = "active" | "completed" | "missed";

/**
 * One row per calendar day. Targets are snapshotted at issue time so a
 * quest issued at E-rank stays an E-rank quest even if the hunter ranks
 * up before finishing it.
 *
 * There is deliberately no run-progress column: distance is read from
 * run_log, which is where the hunter already logs it. Two copies of the
 * same number would eventually disagree.
 */
export const dailyQuest = sqliteTable("daily_quest", {
  id: text("id").primaryKey(),
  day: text("day").notNull().unique(),
  rank: text("rank").notNull(),

  targetPushups: integer("target_pushups").notNull(),
  targetSitups: integer("target_situps").notNull(),
  targetSquats: integer("target_squats").notNull(),
  targetRunKm: real("target_run_km").notNull(),

  progressPushups: integer("progress_pushups").notNull().default(0),
  progressSitups: integer("progress_situps").notNull().default(0),
  progressSquats: integer("progress_squats").notNull().default(0),

  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export type DailyQuestRow = typeof dailyQuest.$inferSelect;
