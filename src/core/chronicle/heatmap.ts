import {
  addDays,
  daysBetween,
  type TrainingDay,
} from "@/core/shared/training-day";

const HEATMAP_DAYS = 365;

export type PenaltyRange = {
  readonly start: TrainingDay;
  /** Null means still open — treated as running through `today`. */
  readonly end: TrainingDay | null;
};

export type HeatmapInput = {
  readonly today: TrainingDay;
  readonly dailyVolume: ReadonlyMap<TrainingDay, number>;
  readonly penaltyRanges: readonly PenaltyRange[];
};

export type HeatmapCell = {
  readonly day: TrainingDay;
  readonly volume: number;
  readonly isPenaltyDay: boolean;
};

/**
 * 365 cells, oldest to newest, ending on `today` — a fixed window rather
 * than a calendar year, so the heatmap always shows exactly the same
 * amount of history regardless of what day of the year it is.
 */
export function buildHeatmap(input: HeatmapInput): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const day = addDays(input.today, -i);
    const isPenaltyDay = input.penaltyRanges.some((range) => {
      const end = range.end ?? input.today;
      return daysBetween(range.start, day) >= 0 && daysBetween(day, end) >= 0;
    });
    cells.push({
      day,
      volume: input.dailyVolume.get(day) ?? 0,
      isPenaltyDay,
    });
  }
  return cells;
}
