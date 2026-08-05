import { ok, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

export type LogRunInput = {
  day: string;
  distanceKm: number;
  durationSec: number;
  clientActionId: string;
};

export type LogRunResult = {
  runId: string;
  events: DomainEvent[];
};

export async function logRun(
  container: Container,
  input: LogRunInput,
): Promise<Result<LogRunResult, never>> {
  const cached = await container.idempotency.find<LogRunResult>(
    input.clientActionId,
  );
  if (cached) return ok(cached);

  const now = container.clock.now();
  const runId = container.newId();

  await container.training.createRun({
    id: runId,
    day: input.day,
    distanceKm: input.distanceKm,
    durationSec: input.durationSec,
    loggedAt: now,
  });

  const result: LogRunResult = {
    runId,
    events: [
      {
        type: "RunLogged",
        distanceKm: input.distanceKm,
        durationSec: input.durationSec,
      },
    ],
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}
