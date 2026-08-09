import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import {
  addDays,
  startOfIsoWeek,
  toTrainingDay,
} from "@/core/shared/training-day";
import {
  HOURGLASS_MAX_PER_WEEK,
  HOURGLASS_OF_GRACE_COST,
} from "@/core/economy/pricing";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyHourglassResult = {
  day: string;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyHourglassError =
  | { type: "hunter-not-found" }
  | { type: "hourglass-already-active" }
  | { type: "hourglass-already-used-this-week" }
  | { type: "insufficient-gold" };

/**
 * Buys today's Daily Quest four extra hours.
 *
 * The 00:00 reset sees the grace row and leaves the quest unjudged; a
 * second cron at 04:00 judges it then. So this does not forgive a missed
 * quest — it moves the deadline, and the hunter still has to finish.
 *
 * Capped at one a week, which is what stops it becoming a subscription to
 * never being judged at all.
 */
export async function buyHourglassOfGrace(
  container: Container,
): Promise<Result<BuyHourglassResult, BuyHourglassError>> {
  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);

  if (await container.mitigation.graceForDay(today)) {
    return err({ type: "hourglass-already-active" });
  }

  const weekStart = startOfIsoWeek(today);
  const usedThisWeek = await container.mitigation.gracesBetween(
    weekStart,
    addDays(weekStart, 6),
  );
  if (usedThisWeek.length >= HOURGLASS_MAX_PER_WEEK) {
    return err({ type: "hourglass-already-used-this-week" });
  }

  const spent = await spendGold(
    container,
    HOURGLASS_OF_GRACE_COST,
    "hourglass-of-grace",
  );
  if (!spent.ok) return err(spent.error);

  await container.mitigation.grantGrace(today, now);

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(events, today, now);

  return ok({ day: today, goldRemaining: spent.value.goldRemaining, events });
}
