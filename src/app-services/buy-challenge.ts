import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { toTrainingDay } from "@/core/shared/training-day";
import type { ChallengeType } from "@/core/economy/challenges";
import {
  BOSS_RAID_COST,
  DEMON_CASTLE_FLOOR_COST,
  RED_GATE_COST,
} from "@/core/economy/pricing";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyChallengeInput = {
  type: ChallengeType;
  /** Required for demon-castle, ignored for the other two. */
  floor?: number;
};

export type BuyChallengeResult = {
  type: ChallengeType;
  floor: number | null;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyChallengeError =
  | { type: "hunter-not-found" }
  | { type: "challenge-already-pending" }
  | { type: "floor-locked" }
  | { type: "insufficient-gold" };

export function challengeCost(type: ChallengeType): number {
  switch (type) {
    case "red-gate":
      return RED_GATE_COST;
    case "boss-raid":
      return BOSS_RAID_COST;
    case "demon-castle":
      return DEMON_CASTLE_FLOOR_COST;
  }
}

/**
 * Buys a harder target for the next session.
 *
 * What the gold buys is the target, never the reward — missing it pays
 * nothing extra and the gold is gone. That asymmetry is the whole point:
 * a challenge is a bet on your own training, not a purchase of progress.
 *
 * Exactly one challenge may be open at a time. The single-row table makes
 * two impossible to store; this check makes buying a second an error the
 * hunter can read instead of a silent overwrite of what they already paid for.
 */
export async function buyChallenge(
  container: Container,
  input: BuyChallengeInput,
): Promise<Result<BuyChallengeResult, BuyChallengeError>> {
  if (await container.store.pendingChallenge()) {
    return err({ type: "challenge-already-pending" });
  }

  let floor: number | null = null;
  if (input.type === "demon-castle") {
    const highest = await container.store.highestFloorCleared();
    const requested = input.floor ?? highest + 1;
    // The ladder is climbed one rung at a time — no skipping, no repeats.
    if (requested !== highest + 1) return err({ type: "floor-locked" });
    floor = requested;
  }

  const spent = await spendGold(
    container,
    challengeCost(input.type),
    input.type,
  );
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  await container.store.setPendingChallenge({
    type: input.type,
    purchasedAt: now,
    floor,
  });

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(
    events,
    toTrainingDay(now, container.tzOffsetMinutes),
    now,
  );

  return ok({
    type: input.type,
    floor,
    goldRemaining: spent.value.goldRemaining,
    events,
  });
}
