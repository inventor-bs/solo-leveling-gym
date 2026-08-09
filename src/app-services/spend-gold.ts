import { ok, err, type Result } from "@/core/shared/result";
import { gold as makeGold } from "@/core/shared/units";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

export type SpendGoldSuccess = {
  goldRemaining: number;
  /** Returned rather than persisted — the caller batches it with its own. */
  event: DomainEvent;
};

export type SpendGoldError =
  { type: "hunter-not-found" } | { type: "insufficient-gold" };

/**
 * The single place gold leaves the hunter.
 *
 * Every sink goes through here so the balance check and the GoldSpent
 * record can never drift apart, and so a purchase that fails its own rules
 * has always failed BEFORE any gold moved — each caller validates first and
 * calls this last.
 *
 * The event is handed back instead of written, so the caller can persist it
 * in the same batch as whatever else the purchase produced. Persisting here
 * as well would be the double-write the event log has been bitten by before.
 */
export async function spendGold(
  container: Container,
  amount: number,
  source: string,
): Promise<Result<SpendGoldSuccess, SpendGoldError>> {
  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });
  if (hunter.gold < amount) return err({ type: "insufficient-gold" });

  const goldRemaining = hunter.gold - amount;
  await container.hunters.update({ gold: goldRemaining });

  return ok({
    goldRemaining,
    event: { type: "GoldSpent", amount: makeGold(amount), source },
  });
}
