import type { TimelineEntry } from "@/core/chronicle/timeline";

const ICON: Record<TimelineEntry["kind"], string> = {
  arise: "⚔",
  "rank-up": "▲",
  pr: "✦",
  "penalty-zone": "⚠",
};

const LABEL: Record<TimelineEntry["kind"], string> = {
  arise: "ARISE",
  "rank-up": "RANK UP",
  pr: "PR",
  "penalty-zone": "PENALTY ZONE",
};

export function EventTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-slate-500">
        No history yet — this fills in as you train.
      </p>
    );
  }

  // toTimelineEntries returns oldest first; the page reads newest first.
  const newestFirst = [...entries].reverse();

  return (
    <ul className="space-y-2">
      {newestFirst.map((entry, i) => (
        <li
          key={`${entry.day}-${i}`}
          className="flex items-baseline gap-3 font-mono text-sm"
        >
          <span className="text-slate-600 w-24 shrink-0">{entry.day}</span>
          <span className="text-system-blue/70 w-6 shrink-0">
            {ICON[entry.kind]}
          </span>
          <span className="text-slate-500 w-28 shrink-0 text-xs tracking-widest">
            {LABEL[entry.kind]}
          </span>
          <span className="text-slate-300">{entry.summary}</span>
        </li>
      ))}
    </ul>
  );
}
