"use client";

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { WeekBucket } from "@/app-services/chronicle-view";

export function WeeklyVolumeChart({ weeks }: { weeks: WeekBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={weeks}>
        <XAxis
          dataKey="weekStart"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          interval={Math.max(0, Math.floor(weeks.length / 8) - 1)}
        />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e3a5f" }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Bar dataKey="volume" fill="#38bdf8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
