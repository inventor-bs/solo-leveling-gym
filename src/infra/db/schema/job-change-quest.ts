import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * A singleton row holding the most recent Job Change attempt — there is
 * only ever one active or most-recently-resolved attempt at a time, the
 * same shape as `sessionBank`. Starting a new attempt overwrites this row
 * rather than inserting a second one — a retry replaces the prior attempt's
 * record, it does not accumulate a history table nothing reads.
 */
export const jobChangeQuest = sqliteTable("job_change_quest", {
  id: text("id").primaryKey(),
  startedDay: text("started_day").notNull(),
  consecutiveCleared: integer("consecutive_cleared").notNull().default(0),
  failedAt: integer("failed_at"),
  completedAt: integer("completed_at"),
});

export type JobChangeQuestRow = typeof jobChangeQuest.$inferSelect;

export const JOB_CHANGE_QUEST_ID = "singleton";
