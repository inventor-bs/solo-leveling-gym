import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { addDays, toTrainingDay } from "@/core/shared/training-day";
import { SHADOW_FEED_COST, SHADOW_FEED_DAYS } from "@/core/economy/pricing";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyShadowFeedResult = {
  shadowId: string;
  extendedUntilDay: string;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyShadowFeedError =
  | { type: "hunter-not-found" }
  | { type: "shadow-not-found" }
  | { type: "shadow-not-extracted" }
  | { type: "insufficient-gold" };

/**
 * Buys one shadow three more days before it starts to weaken.
 *
 * Writes only a reference day. The shadow's stored EXP is a measured record
 * of volume actually lifted and is never rewritten here — weakening has
 * always been computed at read time, and this only changes the number of
 * days that computation is handed.
 *
 * Feeding replaces rather than stacks: three days from today, every time.
 * Stacking would let a hoard of gold buy indefinite neglect, which is the
 * one thing the mechanic exists to prevent.
 */
export async function buyShadowFeed(
  container: Container,
  shadowId: string,
): Promise<Result<BuyShadowFeedResult, BuyShadowFeedError>> {
  const shadow = await container.shadows.byId(shadowId);
  if (!shadow) return err({ type: "shadow-not-found" });
  if (shadow.extractedAt === null) {
    return err({ type: "shadow-not-extracted" });
  }

  const spent = await spendGold(container, SHADOW_FEED_COST, "shadow-feed");
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  const extendedUntilDay = addDays(today, SHADOW_FEED_DAYS);
  await container.mitigation.feed(shadowId, extendedUntilDay);

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(events, today, now);

  return ok({
    shadowId,
    extendedUntilDay,
    goldRemaining: spent.value.goldRemaining,
    events,
  });
}
