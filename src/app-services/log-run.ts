import { ok, type Result } from "@/core/shared/result";
import { CARDIO_EXP_PER_KM } from "@/core/shadow/roster";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";
import type { TrainingDay } from "@/core/shared/training-day";

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

  const kaiselBefore = await container.shadows.byId("kaisel");
  const kaiselArising =
    kaiselBefore !== null && kaiselBefore.extractedAt === null;
  if (kaiselBefore) {
    if (kaiselArising) {
      await container.shadows.extract("kaisel", now);
    }
    await container.shadows.addExp(
      "kaisel",
      input.distanceKm * CARDIO_EXP_PER_KM,
      input.day,
    );
  }

  const events: DomainEvent[] = [
    {
      type: "RunLogged",
      distanceKm: input.distanceKm,
      durationSec: input.durationSec,
    },
  ];
  if (kaiselArising) {
    events.push({
      type: "ShadowArisen",
      shadowId: "kaisel",
      shadowName: "Kaisel",
    });
  }

  const result: LogRunResult = { runId, events };
  await container.idempotency.remember(input.clientActionId, result, now);
  await container.events.record(events, input.day as TrainingDay, now);
  return ok(result);
}
