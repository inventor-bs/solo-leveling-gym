import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per day whose missed-quest judgment was bought a few extra hours.
 *
 * There is deliberately no "judged" column. Whether a grace day has been
 * judged yet is already recorded by the quest itself — its status is still
 * "active" until something judges it — and a second copy of that fact would
 * be free to drift out of step with the first.
 */
export const hourglassGrace = sqliteTable("hourglass_grace", {
  day: text("day").primaryKey(),
  usedAt: integer("used_at").notNull(),
});

export type HourglassGraceRow = typeof hourglassGrace.$inferSelect;

/**
 * One row per fed shadow, holding the day its inactivity clock is treated
 * as starting from.
 *
 * This never touches shadow.exp. Weakening has always been computed at read
 * time from the stored EXP and the last trained day; feeding only lowers the
 * day count that computation is handed, so the stored measurement stays
 * exactly what the training produced.
 */
export const shadowFeed = sqliteTable("shadow_feed", {
  shadowId: text("shadow_id").primaryKey(),
  extendedUntilDay: text("extended_until_day").notNull(),
});

export type ShadowFeedRow = typeof shadowFeed.$inferSelect;
