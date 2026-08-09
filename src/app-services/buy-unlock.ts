import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { toTrainingDay } from "@/core/shared/training-day";
import { unlockByKey, meetsRequirement } from "@/core/economy/unlocks";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";
import { getShadowArmyView } from "./shadow-view";

export type BuyUnlockResult = {
  key: string;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyUnlockError =
  | { type: "hunter-not-found" }
  | { type: "unknown-unlock" }
  | { type: "already-unlocked" }
  | { type: "requirement-not-met" }
  | { type: "insufficient-gold" };

/**
 * Buys the RIGHT to use a program, an extra exercise, or a dungeon type.
 *
 * Writes exactly one row and nothing else: no program_day, no exercise. What
 * to actually train is a coaching decision the hunter makes when they are
 * ready, and a purchase should not make it for them.
 *
 * Every refusal happens before spendGold is called, so a rejected purchase
 * can never leave the hunter poorer.
 */
export async function buyUnlock(
  container: Container,
  key: string,
): Promise<Result<BuyUnlockResult, BuyUnlockError>> {
  const def = unlockByKey(key);
  if (!def) return err({ type: "unknown-unlock" });

  if (await container.store.isUnlocked(key)) {
    return err({ type: "already-unlocked" });
  }

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  // Only fetched for an army-gated unlock: getShadowArmyView walks the whole
  // roster, and a level gate has no use for it.
  const armyRank =
    def.requirement.kind === "army-rank"
      ? (await getShadowArmyView(container)).armyRank
      : null;

  if (!meetsRequirement(def.requirement, { level: hunter.level, armyRank })) {
    return err({ type: "requirement-not-met" });
  }

  const spent = await spendGold(container, def.cost, key);
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  await container.store.unlock(key, now);

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(
    events,
    toTrainingDay(now, container.tzOffsetMinutes),
    now,
  );

  return ok({ key, goldRemaining: spent.value.goldRemaining, events });
}
