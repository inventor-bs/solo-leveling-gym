import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import type { TrainingDay } from "@/core/shared/training-day";
import { expAfterPenalty } from "@/core/penalty/penalty";
import { penaltyVariantFor } from "@/core/penalty/variants";
import { penaltyExpLossMultiplier } from "@/core/title/buffs";
import { tenacityLossMultiplier } from "@/core/skill/buffs";
import type { PenaltyRow } from "@/infra/db/schema/penalty";
import type { Container } from "@/server/container";
import { equippedTitleId } from "./equipped-title";

export type EnterPenaltyResult = {
  penalty: PenaltyRow;
  expLost: number;
  events: DomainEvent[];
};

export type EnterPenaltyError =
  { type: "hunter-not-found" } | { type: "penalty-already-active" };

/**
 * Opens a penalty episode for a day whose Daily Quest went unfinished.
 *
 * Refuses to open a second one while any episode is still open. Five stuck
 * days must leave the hunter owing exactly one Survival Quest, not five.
 */
export async function enterPenalty(
  container: Container,
  day: TrainingDay,
): Promise<Result<EnterPenaltyResult, EnterPenaltyError>> {
  const existing = await container.penalties.active();
  if (existing) return err({ type: "penalty-already-active" });

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  const equipped = await equippedTitleId(container, hunter);
  const equippedSkills = new Set(await container.skills.equippedIds());
  const remaining = expAfterPenalty(
    hunter.exp,
    penaltyExpLossMultiplier(equipped) * tenacityLossMultiplier(equippedSkills),
  );
  const expLost = hunter.exp - remaining;
  const variant = penaltyVariantFor(await container.penalties.countAll());
  const now = container.clock.now();

  // Only exp moves. level, rank and every stat column stay exactly as they
  // are: the stat penalty is an adjustment applied when stats are read.
  await container.hunters.update({ exp: remaining });

  const row = await container.penalties.create({
    id: container.newId(),
    startedDay: day,
    startedAt: now,
    reason: "daily-quest-missed",
    variantId: variant.id,
    expLost,
  });

  const events: DomainEvent[] = [
    { type: "PenaltyStarted", day, variantId: variant.id, expLost },
  ];
  await container.events.record(events, day, now);

  return ok({
    penalty: row,
    expLost,
    events,
  });
}
