import type { DomainEvent } from "@/core/shared/events";
import { ok, err, type Result } from "@/core/shared/result";
import {
  addDays,
  isoWeekdayOf,
  startOfIsoWeek,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { kg, reps } from "@/core/shared/units";
import { effectiveScheduledWeekdays } from "@/core/skill/schedule-swap";
import {
  carriedSets,
  dungeonBreakMultiplier,
} from "@/core/training/dungeon-break";
import {
  AMRAP_TIME_LIMIT_SEC,
  suggestNextLoad,
  type DungeonType,
  type OverloadAction,
} from "@/core/training/overload";
import {
  dungeonTypeUnlockKey,
  type DungeonTypeUnlockId,
} from "@/core/economy/unlocks";
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
  dungeonType: DungeonType;
  /** Displayed for AMRAP only, and never enforced. Null for every other type. */
  timeLimitSec: number | null;
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
  /**
   * Per-exercise structure for THIS session only. Nothing about the choice
   * is persisted: volume, e1RM, PR detection and dungeon rank all read the
   * raw logged sets and are identical whichever type was picked.
   */
  dungeonTypeOverrides?: Record<string, DungeonTypeUnlockId>;
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
  const baseWeekdays = new Set(scheduled.map((d) => d.weekday));
  const lastCompleted = await container.training.lastCompletedSessionDay();
  const windowStart = lastCompleted
    ? addDays(lastCompleted as TrainingDay, 1)
    : day;

  // A Shadow Exchange swap only changes which weekday counts as scheduled
  // for the one ISO week it names — every other week in the gap still
  // uses the base program schedule, so the swap lookup runs per cursor day.
  let missedSessions = 0;
  for (let cursor = windowStart; cursor < day; cursor = addDays(cursor, 1)) {
    const swap = await container.skills.swapForWeek(startOfIsoWeek(cursor));
    const scheduledWeekdays = effectiveScheduledWeekdays(
      baseWeekdays,
      swap,
      cursor,
    );
    if (scheduledWeekdays.has(isoWeekdayOf(cursor))) {
      missedSessions += 1;
    }
  }
  const multiplier = dungeonBreakMultiplier(missedSessions);

  // An override only counts if its type was actually bought. A missing
  // unlock silently falls back to standard rather than failing the call:
  // an unowned label must never be able to stop a session from opening.
  const unlockedKeys = new Set(await container.store.unlockedKeys());
  const overrides = input.dungeonTypeOverrides ?? {};
  const dungeonTypeFor = (exerciseId: string): DungeonType => {
    const requested = overrides[exerciseId];
    if (requested === undefined) return "standard";
    return unlockedKeys.has(dungeonTypeUnlockKey(requested))
      ? requested
      : "standard";
  };

  const plan: PlannedExercise[] = [];
  for (const { exercise, slot } of program.exercises) {
    const history = await container.training.getExercisePerformanceHistory(
      exercise.id,
      2,
    );
    const dungeonType = dungeonTypeFor(exercise.id);
    const decision = suggestNextLoad(
      history,
      { min: reps(slot.repMin), max: reps(slot.repMax) },
      kg(exercise.incrementKg),
      dungeonType,
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
      dungeonType,
      timeLimitSec: dungeonType === "amrap" ? AMRAP_TIME_LIMIT_SEC : null,
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
