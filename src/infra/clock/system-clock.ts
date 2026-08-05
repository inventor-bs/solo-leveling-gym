import type { ClockPort } from "@/ports/clock.port";
import { epoch } from "@/core/shared/units";

export const systemClock: ClockPort = {
  now: () => epoch(Date.now()),
};

/** Clock đứng yên, dùng cho test. */
export function fixedClock(iso: string): ClockPort {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    throw new Error(`fixedClock: chuỗi ISO không hợp lệ: ${iso}`);
  }
  const at = epoch(parsed);
  return { now: () => at };
}
