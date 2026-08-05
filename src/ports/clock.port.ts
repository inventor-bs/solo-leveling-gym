import type { Epoch } from "@/core/shared/units";

/**
 * Lý do port này tồn tại: app đầy logic phụ thuộc thời gian
 * (reset quest 00:00, quest hết hạn, Penalty Zone, shadow suy yếu).
 * Nếu core gọi thẳng Date.now() thì không thể test "23:59 vs 00:01"
 * mà không đổi giờ hệ thống.
 */
export interface ClockPort {
  now(): Epoch;
}
