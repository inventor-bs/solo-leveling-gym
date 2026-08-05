import { ok, err, type Result } from "@/core/shared/result";
import { toTrainingDay } from "@/core/shared/training-day";
import { kg, reps } from "@/core/shared/units";
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
      targetSets: slot.targetSets,
      repMin: slot.repMin,
      repMax: slot.repMax,
      suggestedWeight: decision.weight,
      suggestedReps: decision.targetReps,
      overloadAction: decision.action,
    });
  }

  const result: StartSessionResult = {
    sessionId,
    day,
    programDayId: input.programDayId,
    startedAt: now,
    plan,
  };
  await container.idempotency.remember(input.clientActionId, result, now);
  return ok(result);
}
