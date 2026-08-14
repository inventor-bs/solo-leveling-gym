import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * One row per soldier, nine total, seeded at onboarding.
 *
 * `extractedAt` null means not yet extracted — the same "null timestamp is
 * the state" pattern already used for `penalty.endedAt` and `session.endedAt`
 * in this codebase, rather than a second boolean that could drift from it.
 *
 * `exp` only ever grows from real volume; weakening is computed at read
 * time from `exp` and `lastTrainedDay`, never written back here.
 */
export const shadow = sqliteTable("shadow", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Null only for Bellion. */
  muscle: text("muscle"),
  exp: real("exp").notNull().default(0),
  extractedAt: integer("extracted_at"),
  /** TrainingDay (YYYY-MM-DD). Null until the shadow's muscle group is first trained. */
  lastTrainedDay: text("last_trained_day"),
  /**
   * Purely cosmetic, and nothing outside the render path ever reads it:
   * not exp, not weakening, not Army Rank. Null is the state, matching
   * extractedAt / lastTrainedDay above.
   */
  equippedSkinId: text("equipped_skin_id"),
});

export type ShadowRow = typeof shadow.$inferSelect;
