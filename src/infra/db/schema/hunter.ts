import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * Bảng một dòng. id luôn bằng 1.
 * App phục vụ đúng một hunter theo thiết kế.
 *
 * 6 stat là số ĐO LƯỜNG (spec §1.3): luôn lưu giá trị gốc suy ra
 * từ set_log. Mọi modifier (penalty -15%, buff) áp ở tầng đọc,
 * KHÔNG bao giờ ghi đè các cột này.
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
