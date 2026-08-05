import { ok, err, type Result } from "@/core/shared/result";
import { kg, reps as makeReps } from "@/core/shared/units";
import { estimateOneRepMax } from "@/core/training/pr";
import type { DomainEvent } from "@/core/shared/events";
import type { Container } from "@/server/container";

export type LogSetInput = {
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  weight: number;
  completed: boolean;
  clientActionId: string;
};

export type LogSetResult = {
  isPr: boolean;
  events: DomainEvent[];
};

export type LogSetError =
  { type: "session-not-found" } | { type: "session-already-completed" };

export async function logSet(
  container: Container,
  input: LogSetInput,
): Promise<Result<LogSetResult, LogSetError>> {
  const cached = await container.idempotency.find<LogSetResult>(
    input.clientActionId,
  );
  if (cached) return ok(cached);

  const session = await container.training.getSession(input.sessionId);
  if (!session) return err({ type: "session-not-found" });
  if (session.endedAt !== null) {
    return err({ type: "session-already-completed" });
  }

  let isPr = false;
  if (input.completed && input.weight > 0) {
    const previousBest = await container.training.bestHistoricalE1rm(
      input.exerciseId,
      input.sessionId,
    );
    const newE1rm = estimateOneRepMax(kg(input.weight), makeReps(input.reps));
    isPr = newE1rm > previousBest;
  }

  const now = container.clock.now();
  await container.training.upsertSetLog({
    id: container.newId(),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setIndex: input.setIndex,
    reps: input.reps,
    weight: input.weight,
    completed: input.completed,
    isPr,
    loggedAt: now,
  });

  const events: DomainEvent[] = [
    {
      type: "SetLogged",
      exerciseId: input.exerciseId,
      setIndex: input.setIndex,
    },
  ];
  if (isPr) {
    events.push({
      type: "PrAchieved",
      exerciseId: input.exerciseId,
      newE1rm: estimateOneRepMax(kg(input.weight), makeReps(input.reps)),
      // Deliberately 0, not re-fetched: the exact prior value isn't consumed
      // by anything yet. If a later phase needs "you beat your old record
      // of X" copy, capture `previousBest` above before this point instead
      // of guessing at it here.
      previousE1rm: kg(0),
    });
  }

  const result: LogSetResult = { isPr, events };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}
