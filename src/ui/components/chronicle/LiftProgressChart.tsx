"use client";

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { LiftProgress } from "@/app-services/chronicle-view";

const COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#facc15", "#4ade80"];

/** Left-joins every lift's points onto the union of all days any of them were trained. */
function mergeSeries(lifts: LiftProgress[]) {
  const days = Array.from(
    new Set(lifts.flatMap((l) => l.points.map((p) => p.day))),
  ).sort();
  return days.map((day) => {
    const row: Record<string, string | number> = { day };
    for (const lift of lifts) {
      const point = lift.points.find((p) => p.day === day);
      if (point) row[lift.exerciseId] = point.e1rm;
    }
    return row;
  });
}

export function LiftProgressChart({ lifts }: { lifts: LiftProgress[] }) {
  if (lifts.every((l) => l.points.length === 0)) {
    return (
      <p className="font-mono text-xs text-slate-500">
        No main lift history yet.
      </p>
    );
  }

  const data = mergeSeries(lifts);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e3a5f" }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {lifts.map((lift, i) => (
          <Line
            key={lift.exerciseId}
            dataKey={lift.exerciseId}
            name={lift.exerciseName}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
