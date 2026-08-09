import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { isoWeekdayOf, toTrainingDay } from "@/core/shared/training-day";
import { isStakeAllowed, maxStake } from "@/core/economy/wager";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type PlaceWagerResult = {
  weekStart: string;
  stakeGold: number;
  maxStake: number;
  goldRemaining: number;
  events: DomainEvent[];
};

export type PlaceWagerError =
  | { type: "hunter-not-found" }
  | { type: "wager-not-monday" }
  | { type: "wager-already-placed" }
  | { type: "stake-too-large" }
  | { type: "insufficient-gold" };

/**
 * Stakes gold on the week that is starting.
 *
 * Monday only, so the whole week is still ahead: betting on Friday that a
 * week already three-quarters trained will be finished is not a bet. The
 * stake leaves immediately, which is what makes the following Monday's
 * verdict a payout question rather than a debt-collection one.
 */
export async function placeWager(
  container: Container,
  stakeGold: number,
): Promise<Result<PlaceWagerResult, PlaceWagerError>> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  if (isoWeekdayOf(today) !== 1) return err({ type: "wager-not-monday" });

  // Today IS the week's Monday, so it is the week key by definition.
  const weekStart = today;
  if (await container.wagers.byWeek(weekStart)) {
    return err({ type: "wager-already-placed" });
  }

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });
  if (!isStakeAllowed(stakeGold, hunter.gold)) {
    return err({ type: "stake-too-large" });
  }

  const spent = await spendGold(container, stakeGold, "wager");
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  await container.wagers.place({ weekStart, stakeGold, placedAt: now });

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(events, weekStart, now);

  return ok({
    weekStart,
    stakeGold,
    maxStake: maxStake(hunter.gold),
    goldRemaining: spent.value.goldRemaining,
    events,
  });
}
