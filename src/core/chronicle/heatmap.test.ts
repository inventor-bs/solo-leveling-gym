import { describe, it, expect } from "vitest";
import { parseTrainingDay } from "@/core/shared/training-day";
import { buildHeatmap } from "./heatmap";

describe("buildHeatmap", () => {
  it("returns exactly 365 cells, oldest first, ending on today", () => {
    const cells = buildHeatmap({
      today: parseTrainingDay("2026-08-08"),
      dailyVolume: new Map(),
      penaltyRanges: [],
    });
    expect(cells).toHaveLength(365);
    expect(cells[0]!.day).toBe(parseTrainingDay("2025-08-09"));
    expect(cells[364]!.day).toBe(parseTrainingDay("2026-08-08"));
  });

  it("fills in a real volume for a day that has one, zero for a day that doesn't", () => {
    const cells = buildHeatmap({
      today: parseTrainingDay("2026-08-08"),
      dailyVolume: new Map([[parseTrainingDay("2026-08-08"), 4500]]),
      penaltyRanges: [],
    });
    const today = cells[364]!;
    const yesterday = cells[363]!;
    expect(today.volume).toBe(4500);
    expect(yesterday.volume).toBe(0);
  });

  it("marks every day inside a penalty range as a penalty day, inclusive of both ends", () => {
    const cells = buildHeatmap({
      today: parseTrainingDay("2026-08-08"),
      dailyVolume: new Map(),
      penaltyRanges: [
        {
          start: parseTrainingDay("2026-08-05"),
          end: parseTrainingDay("2026-08-07"),
        },
      ],
    });
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get(parseTrainingDay("2026-08-04"))!.isPenaltyDay).toBe(false);
    expect(byDay.get(parseTrainingDay("2026-08-05"))!.isPenaltyDay).toBe(true);
    expect(byDay.get(parseTrainingDay("2026-08-06"))!.isPenaltyDay).toBe(true);
    expect(byDay.get(parseTrainingDay("2026-08-07"))!.isPenaltyDay).toBe(true);
    expect(byDay.get(parseTrainingDay("2026-08-08"))!.isPenaltyDay).toBe(false);
  });

  it("REGRESSION: a day is a penalty day even when it also has training volume — red wins the color, but the volume is still reported honestly", () => {
    const cells = buildHeatmap({
      today: parseTrainingDay("2026-08-08"),
      dailyVolume: new Map([[parseTrainingDay("2026-08-05"), 3000]]),
      penaltyRanges: [
        {
          start: parseTrainingDay("2026-08-05"),
          end: parseTrainingDay("2026-08-05"),
        },
      ],
    });
    const day = cells.find((c) => c.day === parseTrainingDay("2026-08-05"))!;
    expect(day.isPenaltyDay).toBe(true);
    expect(day.volume).toBe(3000);
  });

  it("an open penalty range (still active) is treated as running through today", () => {
    const cells = buildHeatmap({
      today: parseTrainingDay("2026-08-08"),
      dailyVolume: new Map(),
      penaltyRanges: [{ start: parseTrainingDay("2026-08-06"), end: null }],
    });
    const byDay = new Map(cells.map((c) => [c.day, c]));
    expect(byDay.get(parseTrainingDay("2026-08-06"))!.isPenaltyDay).toBe(true);
    expect(byDay.get(parseTrainingDay("2026-08-07"))!.isPenaltyDay).toBe(true);
    expect(byDay.get(parseTrainingDay("2026-08-08"))!.isPenaltyDay).toBe(true);
  });
});
