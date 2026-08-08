import type { HeatmapCell } from "@/core/chronicle/heatmap";

const COLUMNS = 53; // 365 days / 7, rounded up — matches a GitHub-style grid
const ROWS = 7;

/** Darker with more volume; a penalty day is always red regardless of volume. */
function cellColor(cell: HeatmapCell, maxVolume: number): string {
  if (cell.isPenaltyDay) return "#dc2626";
  if (cell.volume <= 0) return "#1e293b";
  const intensity = Math.min(1, cell.volume / Math.max(maxVolume, 1));
  // Four discrete steps read better at this cell size than a smooth gradient.
  if (intensity > 0.75) return "#0ea5e9";
  if (intensity > 0.5) return "#0284c7";
  if (intensity > 0.25) return "#0369a1";
  return "#164e63";
}

export function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxVolume = Math.max(0, ...cells.map((c) => c.volume));
  // Column-major: cells[0] is the oldest day, which belongs in column 0.
  const columns: HeatmapCell[][] = Array.from({ length: COLUMNS }, (_, col) =>
    cells.slice(col * ROWS, col * ROWS + ROWS),
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" style={{ width: COLUMNS * 13 }}>
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-[3px]">
            {column.map((cell) => (
              <div
                key={cell.day}
                title={`${cell.day} — ${cell.volume} kg${cell.isPenaltyDay ? " — Penalty Zone" : ""}`}
                className="w-[10px] h-[10px] rounded-sm"
                style={{ backgroundColor: cellColor(cell, maxVolume) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
