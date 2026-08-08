import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * One row per DomainEvent this app has ever produced. `payload` is the
 * event's own fields (everything except `type`) as JSON text — a generic
 * shape on purpose, so a new event variant in core/shared/events.ts never
 * needs a schema migration to start showing up here.
 *
 * `day` is the TrainingDay the event happened on, not when it was
 * written — for most events those are the same instant, but daily-reset
 * judges yesterday's quest today, so its events are stamped with the day
 * they actually occurred.
 */
export const eventLog = sqliteTable("event_log", {
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  occurredAt: integer("occurred_at").notNull(),
});

export type EventLogRow = typeof eventLog.$inferSelect;
