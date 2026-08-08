import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * The day's pre-generated messages. Written once at the reset, read on the
 * request path, never written on it — generation takes seconds and a
 * spinner between finishing a set and being told what it meant would kill
 * the moment the message exists for.
 *
 * Only messages that PASSED the moderation gate are stored, so a row here
 * is a message that was safe to show. A slot with no row falls through to
 * the template, which is a complete answer and not a degraded one.
 */
export const systemMessage = sqliteTable("system_message", {
  /**
   * `${day}:${kind}` — deterministic rather than random, so a retried reset
   * cannot fill the same slot twice. There is exactly one briefing per day.
   */
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  severity: text("severity").notNull(),
  /**
   * Which provider produced it. Named after the provider rather than
   * "generated vs fallback" so a second adapter is distinguishable here
   * without a migration.
   */
  source: text("source").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type SystemMessageRow = typeof systemMessage.$inferSelect;

/** The composite key for a pool slot. */
export function systemMessageId(day: string, kind: string): string {
  return `${day}:${kind}`;
}

/**
 * One row per day of LLM usage. Both counters are operational telemetry:
 * neither is ever shown to the hunter and neither feeds any game rule.
 *
 * `trippedAt` records when the circuit opened. It is deliberately per-day —
 * the breaker closes at the next reset simply because a new day gets a new
 * row, with no timer to get wrong.
 */
export const voiceQuota = sqliteTable("voice_quota", {
  day: text("day").primaryKey(),
  requests: integer("requests").notNull().default(0),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  trippedAt: integer("tripped_at"),
});

export type VoiceQuotaRow = typeof voiceQuota.$inferSelect;
