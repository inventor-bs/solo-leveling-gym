import { ok, err, type Result } from "@/core/shared/result";
import { toTrainingDay } from "@/core/shared/training-day";
import { RUNE_STONE_COST } from "@/core/economy/pricing";
import { SKILL_SLOTS_MAX, slotCapacity } from "@/core/skill/slots";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyRuneStoneResult = {
  slotCapacity: number;
  goldRemaining: number;
};

export type BuyRuneStoneError =
  | { type: "hunter-not-found" }
  | { type: "slots-maxed" }
  | { type: "insufficient-gold" };

/**
 * Gold buys the container, never the power inside it — the capacity check
 * is refused before spendGold runs, same discipline as every other purchase:
 * a rejected buy leaves the hunter's gold untouched.
 */
export async function buyRuneStone(
  container: Container,
): Promise<Result<BuyRuneStoneResult, BuyRuneStoneError>> {
  const purchased = await container.skills.slotsPurchased();
  if (slotCapacity(purchased) >= SKILL_SLOTS_MAX) {
    return err({ type: "slots-maxed" });
  }

  const spent = await spendGold(container, RUNE_STONE_COST, "rune-stone");
  if (!spent.ok) return err(spent.error);

  await container.skills.purchaseSlot();

  const now = container.clock.now();
  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(
    events,
    toTrainingDay(now, container.tzOffsetMinutes),
    now,
  );

  return ok({
    slotCapacity: slotCapacity(purchased + 1),
    goldRemaining: spent.value.goldRemaining,
  });
}
