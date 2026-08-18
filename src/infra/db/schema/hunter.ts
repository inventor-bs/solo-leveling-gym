import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * A single-row table. id is always 1.
 * The app serves exactly one hunter by design.
 *
 * The six stats are MEASURED numbers: they always store the
 * raw value derived from set_log. Every modifier (penalty -15%, buffs)
 * is applied at the read layer and must NEVER overwrite these columns.
 */
export const hunter = sqliteTable("hunter", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  rank: text("rank").notNull().default("E"),
  title: text("title"),
  className: text("class_name"),
  /**
   * Which decorative frame is drawn around the worn title, or null. One
   * column for the same reason `title` is one column: only one can be worn,
   * so there is no way to represent wearing two.
   */
  titleFrame: text("title_frame"),
  /**
   * Which purchased voice tone the System speaks in, or null for Cold — the
   * default voice, which is not for sale and needs no unlock. One column for
   * the same reason `title_frame` is one column: only one tone can be active,
   * so there is no way to represent two.
   */
  voiceTone: text("voice_tone"),
  /** JSON array of dashboard panel ids. Null means the default order. */
  dashboardOrder: text("dashboard_order"),
  /**
   * How many times gold has been traded for aura. It multiplies nothing and
   * feeds no other number — it only picks a glow intensity, and stops
   * changing the glow past the visual cap while still costing gold.
   */
  auraLevel: integer("aura_level").notNull().default(0),

  strength: real("strength").notNull().default(0),
  agility: real("agility").notNull().default(0),
  vitality: real("vitality").notNull().default(0),
  intelligence: real("intelligence").notNull().default(0),
  perception: real("perception").notNull().default(0),
  luck: real("luck").notNull().default(0),
  fatigue: real("fatigue").notNull().default(0),

  reasonForHunting: text("reason_for_hunting"),
  tzOffsetMinutes: integer("tz_offset_minutes").notNull().default(420),
  createdAt: integer("created_at").notNull(),
});

export type HunterRow = typeof hunter.$inferSelect;
export type HunterInsert = typeof hunter.$inferInsert;

export const HUNTER_ID = 1;
