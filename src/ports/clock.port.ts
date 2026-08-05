import type { Epoch } from "@/core/shared/units";

/**
 * Why this port exists: the app is full of time-dependent logic
 * (quest reset at 00:00, quest expiry, Penalty Zone, shadow decay).
 * If core called Date.now() directly, "23:59 vs 00:01" could never
 * be tested without changing the system clock.
 */
export interface ClockPort {
  now(): Epoch;
}
