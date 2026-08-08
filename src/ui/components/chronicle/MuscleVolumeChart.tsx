"use client";

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { MuscleGroup } from "@/core/training/types";

export function MuscleVolumeChart({
  muscleVolume,
}: {
  muscleVolume: Record<MuscleGroup, number>;
}) {
  const data = Object.entries(muscleVolume).map(([muscle, volume]) => ({
    muscle,
    volume,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="muscle"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          width={70}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e3a5f" }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Bar dataKey="volume" fill="#a78bfa" />
      </BarChart>
    </ResponsiveContainer>
  );
}
