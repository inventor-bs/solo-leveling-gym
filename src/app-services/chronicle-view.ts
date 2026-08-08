import {
  addDays,
  isoWeekdayOf,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  buildHeatmap,
  type HeatmapCell,
  type PenaltyRange,
} from "@/core/chronicle/heatmap";
import {
  toTimelineEntries,
  type TimelineEntry,
} from "@/core/chronicle/timeline";
import { sessionVolumeLoad, volumeByMuscle } from "@/core/training/volume";
import type {
  MuscleGroup,
  ExerciseDef,
  LoggedSet,
} from "@/core/training/types";
import { reps, kg, epoch } from "@/core/shared/units";
import type { Container } from "@/server/container";

const HISTORY_DAYS = 365;

export type WeekBucket = { weekStart: TrainingDay; volume: number };
export type LiftProgress = {
  exerciseId: string;
  exerciseName: string;
  /** `e1rm` is a plain number here, matching TrainingRepo.e1rmHistory's own
   * return shape — it is display-only data for a chart, not carried
   * through any Kg-typed arithmetic. */
  points: { day: TrainingDay; e1rm: number }[];
};

export type ChronicleView = {
  heatmap: HeatmapCell[];
  timeline: TimelineEntry[];
  weeklyVolume: WeekBucket[];
  liftProgress: LiftProgress[];
  muscleVolume: Record<MuscleGroup, number>;
};

function toCatalogMap(
  rows: readonly {
    id: string;
    name: string;
    muscle: string;
    kind: string;
    isMainLift: boolean;
    incrementKg: number;
  }[],
): Map<string, ExerciseDef> {
  return new Map(
    rows.map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        muscle: e.muscle as MuscleGroup,
        kind: e.kind as "compound" | "isolation",
        isMainLift: e.isMainLift,
        incrementKg: kg(e.incrementKg),
      },
    ]),
  );
}

export async function getChronicleView(
  container: Container,
): Promise<ChronicleView> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const from = addDays(today, -(HISTORY_DAYS - 1));

  const exerciseRows = await container.exercises.all();
  const catalog = toCatalogMap(exerciseRows);

  // Single pass over completed sessions and their sets, feeding both the
  // per-day volume map (heatmap) and the flat set list (muscle breakdown)
  // below — fetching each session's sets once instead of twice.
  const completedSessions = await container.training.completedSessionsBetween(
    from,
    today,
  );
  const dailyVolume = new Map<TrainingDay, number>();
  const allSets: LoggedSet[] = [];
  for (const s of completedSessions) {
    const rows = await container.training.getSetsForSession(s.id);
    const sets: LoggedSet[] = rows.map((r) => ({
      exerciseId: r.exerciseId,
      setIndex: r.setIndex,
      reps: reps(r.reps),
      weight: kg(r.weight),
      completed: r.completed,
    }));
    allSets.push(...sets);
    const day = s.day as TrainingDay;
    dailyVolume.set(day, (dailyVolume.get(day) ?? 0) + sessionVolumeLoad(sets));
  }

  const penaltyRows = await container.penalties.between(from, today);
  const penaltyRanges: PenaltyRange[] = penaltyRows.map((p) => ({
    start: p.startedDay as TrainingDay,
    end:
      p.endedAt === null
        ? null
        : toTrainingDay(epoch(p.endedAt), container.tzOffsetMinutes),
  }));
  const heatmap = buildHeatmap({
    today,
    dailyVolume,
    penaltyRanges,
  });

  const rawEvents = await container.events.between(from, today);
  const exerciseNames = new Map(exerciseRows.map((e) => [e.id, e.name]));
  const timeline = toTimelineEntries(
    rawEvents.map((r) => ({
      type: r.type,
      day: r.day,
      occurredAt: r.occurredAt,
      payload: JSON.parse(r.payload) as unknown,
    })),
    exerciseNames,
  );

  const weeklyMap = new Map<TrainingDay, number>();
  for (const cell of heatmap) {
    const weekStart = addDays(cell.day, -(isoWeekdayOf(cell.day) - 1));
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + cell.volume);
  }
  const weeklyVolume: WeekBucket[] = Array.from(weeklyMap.entries())
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

  const mainLifts = exerciseRows.filter((e) => e.isMainLift);
  const liftProgress: LiftProgress[] = [];
  for (const lift of mainLifts) {
    const history = await container.training.e1rmHistory(lift.id);
    liftProgress.push({
      exerciseId: lift.id,
      exerciseName: lift.name,
      points: history.map((h) => ({ day: h.day as TrainingDay, e1rm: h.e1rm })),
    });
  }

  const muscleVolume = volumeByMuscle(allSets, catalog);

  return { heatmap, timeline, weeklyVolume, liftProgress, muscleVolume };
}
