import type { DomainEvent } from "@/core/shared/events";
import { ok, err, type Result } from "@/core/shared/result";
import {
  addDays,
  isoWeekdayOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { kg, reps } from "@/core/shared/units";
import {
  carriedSets,
  dungeonBreakMultiplier,
} from "@/core/training/dungeon-break";
import { suggestNextLoad, type OverloadAction } from "@/core/training/overload";
import type { Container } from "@/server/container";

export type PlannedExercise = {
  exerciseId: string;
  name: string;
  muscle: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  suggestedWeight: number;
  suggestedReps: number;
  overloadAction: OverloadAction;
};

export type StartSessionResult = {
  sessionId: string;
  day: string;
  programDayId: string;
  startedAt: number;
  plan: PlannedExercise[];
  dungeonBreak: { missedSessions: number; multiplier: number };
  events: DomainEvent[];
};

export type StartSessionError = { type: "program-day-not-found" };

export type StartSessionInput = {
  programDayId: string;
  clientActionId: string;
};

export async function startSession(
  container: Container,
  input: StartSessionInput,
): Promise<Result<StartSessionResult, StartSessionError>> {
  const cached = await container.idempotency.find<StartSessionResult>(
    input.clientActionId,
  );
  if (cached) return ok(cached);

  const program = await container.programs.byId(input.programDayId);
  if (!program) return err({ type: "program-day-not-found" });

  const now = container.clock.now();
  const day = toTrainingDay(now, container.tzOffsetMinutes);
  const sessionId = container.newId();

  await container.training.createSession({
    id: sessionId,
    day,
    programDayId: input.programDayId,
    startedAt: now,
  });

  const scheduled = await container.programs.allDays();
  const scheduledWeekdays = new Set(scheduled.map((d) => d.weekday));
  const lastCompleted = await container.training.lastCompletedSessionDay();
  const windowStart = lastCompleted
    ? addDays(lastCompleted as TrainingDay, 1)
    : day;

  let missedSessions = 0;
  for (let cursor = windowStart; cursor < day; cursor = addDays(cursor, 1)) {
    if (scheduledWeekdays.has(isoWeekdayOf(cursor))) {
      missedSessions += 1;
    }
  }
  const multiplier = dungeonBreakMultiplier(missedSessions);

  const plan: PlannedExercise[] = [];
  for (const { exercise, slot } of program.exercises) {
    const history = await container.training.getExercisePerformanceHistory(
      exercise.id,
      2,
    );
    const decision = suggestNextLoad(
      history,
      { min: reps(slot.repMin), max: reps(slot.repMax) },
      kg(exercise.incrementKg),
    );
    plan.push({
      exerciseId: exercise.id,
      name: exercise.name,
      muscle: exercise.muscle,
      targetSets: carriedSets(slot.targetSets, missedSessions),
      repMin: slot.repMin,
      repMax: slot.repMax,
      suggestedWeight: decision.weight,
      suggestedReps: decision.targetReps,
      overloadAction: decision.action,
    });
  }

  const events: DomainEvent[] = [];
  if (missedSessions > 0) {
    events.push({ type: "DungeonBreak", missedSessions, multiplier });
  }

  const result: StartSessionResult = {
    sessionId,
    day,
    programDayId: input.programDayId,
    startedAt: now,
    plan,
    dungeonBreak: { missedSessions, multiplier },
    events,
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}
