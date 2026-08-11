import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * A singleton counter, same shape as `demonCastleProgress`. `bankedSessions`
 * is earned by depositing a surplus (unscheduled-weekday) session;
 * `pendingCredits` is what withdrawSession moves it into, and what
 * startSession consumes one of per call. Two separate counters rather than
 * one, so "banked but not yet claimed" and "claimed, waiting to be spent on
 * the next session" can never be confused with each other.
 */
export const sessionBank = sqliteTable("session_bank", {
  id: text("id").primaryKey(),
  bankedSessions: integer("banked_sessions").notNull().default(0),
  pendingCredits: integer("pending_credits").notNull().default(0),
  lastDepositedSessionId: text("last_deposited_session_id"),
});

export type SessionBankRow = typeof sessionBank.$inferSelect;

export const SESSION_BANK_ID = "singleton";
