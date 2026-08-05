import {
  sqliteTable,
  text,
  real,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { programDay, exercise } from "./catalog";

/**
 * One dungeon run. endedAt is null while in progress — that's the only
 * signal of "active" status; no separate status column.
 */
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  /** TrainingDay (YYYY-MM-DD), the hunter's local calendar day. */
  day: text("day").notNull(),
  programDayId: text("program_day_id")
    .notNull()
    .references(() => programDay.id),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  /** DungeonRank ("E".."A"), filled only on completion. */
  rank: text("rank"),
});

export type SessionRow = typeof session.$inferSelect;

/**
 * The central table — everything else (stats, PRs, shadow EXP, overload
 * suggestions) is a query over this. One row per set. Unique on
 * (session, exercise, setIndex) so correcting a set updates it in place
 * instead of duplicating.
 */
export const setLog = sqliteTable(
  "set_log",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercise.id),
    setIndex: integer("set_index").notNull(),
    reps: integer("reps").notNull(),
    weight: real("weight").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull(),
    isPr: integer("is_pr", { mode: "boolean" }).notNull().default(false),
    loggedAt: integer("logged_at").notNull(),
  },
  (table) => ({
    naturalKeyIdx: uniqueIndex("set_log_natural_key_idx").on(
      table.sessionId,
      table.exerciseId,
      table.setIndex,
    ),
  }),
);

export type SetLogRow = typeof setLog.$inferSelect;

export const runLog = sqliteTable("run_log", {
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  distanceKm: real("distance_km").notNull(),
  durationSec: integer("duration_sec").notNull(),
  loggedAt: integer("logged_at").notNull(),
});

export type RunLogRow = typeof runLog.$inferSelect;
