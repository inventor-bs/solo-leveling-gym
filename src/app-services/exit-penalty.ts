import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import type { TrainingDay } from "@/core/shared/training-day";
import type { Container } from "@/server/container";
import { getPenaltyView } from "./penalty-view";
import { awardEarnedTitles } from "./award-titles";

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
  const now = container.clock.now();

  const events: DomainEvent[] = [
    { type: "PenaltyCleared", day: view.day, daysStuck: view.daysStuck },
  ];
  // Run after close(), so this escape is already counted.
  events.push(...(await awardEarnedTitles(container)));

  await container.events.record(events, view.day as TrainingDay, now);

  return ok({ daysStuck: view.daysStuck, events });
}
