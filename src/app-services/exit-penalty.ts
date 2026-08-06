import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";
import { getPenaltyView } from "./penalty-view";

export type ExitPenaltyResult = { daysStuck: number; events: DomainEvent[] };

export type ExitPenaltyError =
  { type: "no-active-penalty" } | { type: "survival-incomplete" };

/**
 * Closes the episode. The EXP taken on entry is NOT returned — that half of
 * the punishment is permanent by design, and refunding it would leave the
 * mechanic with no teeth at all.
 */
export async function exitPenalty(
  container: Container,
): Promise<Result<ExitPenaltyResult, ExitPenaltyError>> {
  const view = await getPenaltyView(container);
  if (!view) return err({ type: "no-active-penalty" });
  if (!view.canEscape) return err({ type: "survival-incomplete" });

  await container.penalties.close(view.penaltyId, container.clock.now());

  return ok({
    daysStuck: view.daysStuck,
    events: [
      { type: "PenaltyCleared", day: view.day, daysStuck: view.daysStuck },
    ],
  });
}
