import { parseTrainingDay, toTrainingDay } from "@/core/shared/training-day";
import { liftTrend, type E1rmPoint } from "@/core/training/trend";
import type { Container } from "@/server/container";

export type LiftTrendEntry = {
  exerciseId: string;
  name: string;
  muscle: string;
  /** Heaviest e1RM in the last 28 days. */
  currentE1rm: number | null;
  /** Heaviest e1RM in the 28 days before those. */
  previousE1rm: number | null;
  /** Negative means the lift went backwards. Null when there is nothing to compare. */
  deltaKg: number | null;
  bestE1rm: number;
  bestDay: string | null;
};

/**
 * One row per exercise the hunter has actually lifted, heaviest first.
 *
 * Exercises with no history are dropped rather than listed as zeroes: this
 * table is a record of what was done, and 23 empty rows would bury the
 * handful that mean something.
 */
export async function getLiftTrends(
  container: Container,
): Promise<LiftTrendEntry[]> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const exercises = await container.exercises.all();

  const entries: LiftTrendEntry[] = [];
  for (const e of exercises) {
    const history = await container.training.e1rmHistory(e.id);
    if (history.length === 0) continue;

    // Day strings come back from the DB, so they get parsed rather than cast.
    const points: E1rmPoint[] = history.map((h) => ({
      day: parseTrainingDay(h.day),
      e1rm: h.e1rm,
    }));
    const trend = liftTrend(points, today);

    entries.push({
      exerciseId: e.id,
      name: e.name,
      muscle: e.muscle,
      currentE1rm: trend.current,
      previousE1rm: trend.previous,
      deltaKg: trend.deltaKg,
      bestE1rm: trend.best,
      bestDay: trend.bestDay,
    });
  }

  return entries.sort((a, b) => b.bestE1rm - a.bestE1rm);
}
