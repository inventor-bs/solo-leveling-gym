import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { toTrainingDay } from "@/core/shared/training-day";
import { AURA_VISUAL_MAX_LEVEL } from "@/core/economy/pricing";
import { auraCost, auraVisualTier } from "@/core/cosmetic/aura";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyAuraResult = {
  /** The level AFTER this purchase. */
  auraLevel: number;
  visualTier: number;
  /** True once the glow has stopped changing, which is not an error state. */
  saturated: boolean;
  cost: number;
  nextCost: number;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyAuraError =
  { type: "hunter-not-found" } | { type: "insufficient-gold" };

/**
 * The one cosmetic that can be bought again forever, and the only one that
 * does not go through store_unlock — that table models a single ownership
 * fact, and this is a counter.
 *
 * There is no cap here by design. Past the visual cap a purchase still
 * costs escalating gold and still increments the stored level while
 * changing nothing on screen; the economy needs a sink that never runs out
 * and the screen does not. The Store says so in words before the button is
 * pressed, which is where that honesty belongs — not in a refusal here.
 */
export async function buyAura(
  container: Container,
): Promise<Result<BuyAuraResult, BuyAuraError>> {
  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  const cost = auraCost(hunter.auraLevel);
  const spent = await spendGold(container, cost, "cosmetic:aura");
  if (!spent.ok) return err(spent.error);

  const auraLevel = hunter.auraLevel + 1;
  await container.hunters.update({ auraLevel });

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(events, today, now);

  return ok({
    auraLevel,
    visualTier: auraVisualTier(auraLevel),
    saturated: auraLevel >= AURA_VISUAL_MAX_LEVEL,
    cost,
    nextCost: auraCost(auraLevel),
    goldRemaining: spent.value.goldRemaining,
    events,
  });
}
