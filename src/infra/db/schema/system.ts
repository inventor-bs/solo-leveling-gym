import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Chống xử lý trùng. Sóng phòng gym yếu → người dùng tap lại
 * → không được cộng EXP hai lần.
 *
 * Client sinh clientActionId (UUID) cho mỗi mutation.
 * Lần gọi thứ hai với cùng id trả lại kết quả lần đầu.
 */
export const processedAction = sqliteTable("processed_action", {
  id: text("id").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type ProcessedActionRow = typeof processedAction.$inferSelect;
