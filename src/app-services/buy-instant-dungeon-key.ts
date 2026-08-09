import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { toTrainingDay } from "@/core/shared/training-day";
import { INSTANT_DUNGEON_KEY_COST } from "@/core/economy/pricing";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyInstantDungeonKeyResult = {
  programDayId: string;
  goldSpent: number;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyInstantDungeonKeyError =
  | { type: "hunter-not-found" }
  | { type: "program-day-not-found" }
  | { type: "insufficient-gold" };

/**
 * Buys the right to train a program day the schedule did not open today.
 *
 * Deliberately does NOT start the session. The dungeon screen starts its
 * own from the programDayId in the URL, and starting one here as well would
 * create two sessions for a single purchase. The caller charges, then
 * navigates, and the existing idempotent start path does the rest.
 *
 * There is no row to write: the key is consumed the moment it is bought.
 * A pending_challenge row would imply something still to resolve, and there
 * is nothing — the reward for an unscheduled session is the session.
 */
export async function buyInstantDungeonKey(
  container: Container,
  input: { programDayId: string },
): Promise<Result<BuyInstantDungeonKeyResult, BuyInstantDungeonKeyError>> {
  const program = await container.programs.byId(input.programDayId);
  if (!program) return err({ type: "program-day-not-found" });

  const spent = await spendGold(
    container,
    INSTANT_DUNGEON_KEY_COST,
    "instant-dungeon-key",
  );
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(
    events,
    toTrainingDay(now, container.tzOffsetMinutes),
    now,
  );

  return ok({
    programDayId: input.programDayId,
    goldSpent: INSTANT_DUNGEON_KEY_COST,
    goldRemaining: spent.value.goldRemaining,
    events,
  });
}
