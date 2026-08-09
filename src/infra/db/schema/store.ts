import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * One row per thing the hunter has bought the RIGHT to use. The row's
 * existence is the unlock; there is no "owned" flag and no quantity,
 * because none of these is consumable.
 *
 * Buying a program or an exercise deliberately creates no program_day and
 * no exercise row. Choosing what to actually train is a coaching decision
 * the hunter makes when they are ready to switch, not something a purchase
 * should decide for them.
 *
 * Keys look like "program:ppl", "exercise:back", "dungeon-type:amrap".
 */
export const storeUnlock = sqliteTable("store_unlock", {
  key: text("key").primaryKey(),
  unlockedAt: integer("unlocked_at").notNull(),
});

export type StoreUnlockRow = typeof storeUnlock.$inferSelect;

/**
 * The single challenge the hunter has paid for and not yet resolved.
 *
 * A fixed primary key caps the table at one row by construction: buying a
 * second challenge while one is open is refused by the app-service, and
 * even if that check were bypassed the schema could not represent two.
 *
 * There is no day column on purpose. "Cleared in the same day it was
 * bought" needs the hunter's local day, and converting `purchasedAt` into
 * one requires a timezone offset this layer does not have — the
 * app-service does the conversion through the one file allowed to.
 */
export const pendingChallenge = sqliteTable("pending_challenge", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  purchasedAt: integer("purchased_at").notNull(),
  /** Only Demon Castle uses this; null for the other two types. */
  floor: integer("floor"),
});

export type PendingChallengeRow = typeof pendingChallenge.$inferSelect;

/** The fixed primary key of the single pending_challenge row. */
export const PENDING_CHALLENGE_ID = "singleton";

/**
 * How deep into the Demon Castle the hunter has actually got. A one-way
 * counter: floor N is only purchasable at N-1, and failing a floor leaves
 * this untouched, so the ladder can never be skipped or walked backwards.
 */
export const demonCastleProgress = sqliteTable("demon_castle_progress", {
  id: text("id").primaryKey(),
  highestFloorCleared: integer("highest_floor_cleared").notNull().default(0),
});

export type DemonCastleProgressRow = typeof demonCastleProgress.$inferSelect;

/** The fixed primary key of the single demon_castle_progress row. */
export const DEMON_CASTLE_PROGRESS_ID = "singleton";
