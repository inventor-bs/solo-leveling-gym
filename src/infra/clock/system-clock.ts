import type { ClockPort } from "@/ports/clock.port";
import { epoch } from "@/core/shared/units";

export const systemClock: ClockPort = {
  now: () => epoch(Date.now()),
};

/** A clock frozen at a fixed instant, for tests. */
export function fixedClock(iso: string): ClockPort {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    throw new Error(`fixedClock: invalid ISO string: ${iso}`);
  }
  const at = epoch(parsed);
  return { now: () => at };
}
