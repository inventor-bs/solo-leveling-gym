import {
  addDays,
  isoWeekdayOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import { kg, reps, type Kg } from "@/core/shared/units";
import { sessionVolumeLoad } from "@/core/training/volume";
import { currentStreak } from "@/core/quest/streak";
import type { StatInput } from "@/core/hunter/stats";
import type { LoggedSet } from "@/core/training/types";
import type { Container } from "@/server/container";

/** Every windowed stat field looks back exactly this far, today included. */
export const STAT_WINDOW_DAYS = 28;

/** Long enough that a very long streak is never truncated by the query limit. */
export const QUEST_HISTORY_DAYS = 400;

/**
 * Assembles the input to deriveStats entirely from stored training data.
 *
 * Every field traces to a real row: sets, sessions, runs, program slots and
 * quest outcomes. There is no parameter here a buff or an item could reach —
 * the six stats are measured numbers and stay that way.
 */
export async function buildStatInput(container: Container): Promise<StatInput> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const from = addDays(today, -(STAT_WINDOW_DAYS - 1));

  // STR is not windowed: it reads the best each main lift has ever shown.
  const exercises = await container.exercises.all();
  const mainLiftE1rms = new Map<string, Kg>();
  for (const e of exercises) {
    if (!e.isMainLift) continue;
    mainLiftE1rms.set(e.id, await container.training.bestHistoricalE1rm(e.id));
  }

  const runs = await container.training.runsBetween(from, today);
  const km28d = runs.reduce((sum, r) => sum + r.distanceKm, 0);
  const runSeconds = runs.reduce((sum, r) => sum + r.durationSec, 0);
  const avgPaceSecPerKm = km28d > 0 ? runSeconds / km28d : null;

  const sessions = await container.training.completedSessionsBetween(
    from,
    today,
  );
  let volume28d = 0;
  let setsCompleted28d = 0;
  let setsPlanned28d = 0;
  // Four program days at most, so this cache turns an N+1 into four reads.
  const plannedSetsByProgramDay = new Map<string, number>();

  for (const s of sessions) {
    const rows = await container.training.getSetsForSession(s.id);
    const sets: LoggedSet[] = rows.map((r) => ({
      exerciseId: r.exerciseId,
      setIndex: r.setIndex,
      reps: reps(r.reps),
      weight: kg(r.weight),
      completed: r.completed,
    }));
    volume28d += sessionVolumeLoad(sets);
    setsCompleted28d += sets.filter((x) => x.completed).length;

    let planned = plannedSetsByProgramDay.get(s.programDayId);
    if (planned === undefined) {
      const program = await container.programs.byId(s.programDayId);
      planned = (program?.exercises ?? []).reduce(
        (sum, e) => sum + e.slot.targetSets,
        0,
      );
      plannedSetsByProgramDay.set(s.programDayId, planned);
    }
    setsPlanned28d += planned;
  }

  // How many gates the schedule OPENED in the window, whether or not the
  // hunter walked into them — the denominator of schedule adherence.
  const scheduledWeekdays = new Set(
    (await container.programs.allDays()).map((d) => d.weekday),
  );
  let sessionsScheduled28d = 0;
  for (
    let cursor: TrainingDay = from;
    cursor <= today;
    cursor = addDays(cursor, 1)
  ) {
    if (scheduledWeekdays.has(isoWeekdayOf(cursor))) sessionsScheduled28d += 1;
  }

  const outcomes = await container.quests.recentOutcomes(QUEST_HISTORY_DAYS);
  const inWindow = outcomes.filter((o) => o.day >= from && o.day <= today);
  const streakDays = currentStreak(
    outcomes.map((o) => ({
      day: o.day as TrainingDay,
      completed: o.completed,
    })),
    today,
  );

  return {
    mainLiftE1rms,
    km28d,
    avgPaceSecPerKm,
    volume28d,
    sessionsCompleted28d: sessions.length,
    sessionsScheduled28d,
    setsCompleted28d,
    setsPlanned28d,
    // The quest half of INT is fed by the Daily Quest, the only quest system
    // that exists. Passing zeroes would be worse than a name mismatch: the
    // ratio helper returns 0 when nothing was issued, which would cap INT at
    // 70% of its range forever and read on the radar as a broken stat.
    sideQuestsCompleted28d: inWindow.filter((o) => o.completed).length,
    sideQuestsIssued28d: inWindow.length,
    streakDays,
    // Hidden Quests are not built. A count nobody can produce is not a
    // number this app is allowed to show, so LUCK comes from the streak
    // alone until they exist.
    hiddenQuestsFound: 0,
  };
}
