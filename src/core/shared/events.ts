import type { Exp, Gold } from "./units";

/**
 * Domain event = kết quả trả về của core, KHÔNG phải hạ tầng.
 * app-services nhận mảng này, ghi DB trong một transaction,
 * rồi đẩy sang UI để chạy animation.
 *
 * Mỗi phase sau sẽ thêm biến thể mới vào union này.
 */
export type DomainEvent =
  | { type: "ExpGained"; amount: Exp; source: string }
  | { type: "GoldGained"; amount: Gold; source: string }
  | { type: "LevelUp"; from: number; to: number };

export type DomainEventOfType<T extends DomainEvent["type"]> = Extract<
  DomainEvent,
  { type: T }
>;
