"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { Stats } from "@/core/hunter/stats";

const AXES = [
  { key: "strength", label: "STR" },
  { key: "agility", label: "AGI" },
  { key: "vitality", label: "VIT" },
  { key: "intelligence", label: "INT" },
  { key: "perception", label: "PER" },
  { key: "luck", label: "LUK" },
] as const;

export function StatRadar({ stats }: { stats: Stats }) {
  const data = AXES.map((a) => ({ label: a.label, value: stats[a.key] }));

  // The six stats sit on genuinely different natural scales — PER and INT
  // are percentages, LUCK is capped at 100, STR is a tenth of summed e1RM.
  // A fixed 0-100 axis would clip a strong hunter's STR off the edge, which
  // would be a lie about a measured number, so the axis grows instead.
  const max = Math.max(100, ...data.map((d) => d.value));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#1e3a5f" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
        />
        <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          stroke="#38bdf8"
          fill="#38bdf8"
          fillOpacity={0.35}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
