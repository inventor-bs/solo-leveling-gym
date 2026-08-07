import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per earnable title, seeded up front — the same shape as the shadow
 * roster, so the Status page can list the locked ones alongside the earned.
 *
 * `earnedAt` null means not yet earned, matching the "null timestamp is the
 * state" pattern already used by penalty.endedAt, session.endedAt and
 * shadow.extractedAt. Earning is one-way and permanent: a 30-day streak that
 * later breaks does not take the title back, which is why this is a stored
 * timestamp rather than a condition re-evaluated on every read.
 *
 * Which title is currently WORN is not here — only one can be worn at a
 * time, so it lives on the single-row hunter table as hunter.title. One
 * column means there is no way to represent wearing two.
 */
export const title = sqliteTable("title", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  earnedAt: integer("earned_at"),
});

export type TitleRow = typeof title.$inferSelect;
