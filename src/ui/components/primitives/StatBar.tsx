"use client";
import { motion } from "framer-motion";
import clsx from "clsx";

interface StatBarProps {
  label: string;
  shortLabel: string;
  value: number;
  maxValue?: number;
  color?: string;
  delay?: number;
}

const STAT_COLORS: Record<string, string> = {
  STR: "from-orange-500 to-red-500",
  AGI: "from-green-400 to-emerald-500",
  VIT: "from-blue-400 to-cyan-400",
  INT: "from-purple-400 to-violet-500",
  PER: "from-yellow-400 to-amber-500",
  LUK: "from-pink-400 to-rose-400",
};

const STAT_GLOW: Record<string, string> = {
  STR: "shadow-[0_0_8px_rgba(249,115,22,0.6)]",
  AGI: "shadow-[0_0_8px_rgba(74,222,128,0.6)]",
  VIT: "shadow-[0_0_8px_rgba(96,165,250,0.6)]",
  INT: "shadow-[0_0_8px_rgba(167,139,250,0.6)]",
  PER: "shadow-[0_0_8px_rgba(245,158,11,0.6)]",
  LUK: "shadow-[0_0_8px_rgba(244,114,182,0.6)]",
};

export function StatBar({
  label,
  shortLabel,
  value,
  maxValue = 100,
  delay = 0,
}: StatBarProps) {
  const pct = Math.min((value / maxValue) * 100, 100);
  const gradient =
    STAT_COLORS[shortLabel] || "from-system-blue to-monarch-purple";
  const glow = STAT_GLOW[shortLabel] || "";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "font-mono text-xs font-bold w-8",
              glow.includes("orange") ? "text-orange-400" : "text-slate-300",
            )}
          >
            {shortLabel}
          </span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
        <motion.span
          className="font-mono text-sm font-bold text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        >
          {value}
        </motion.span>
      </div>
      <div className="h-2 bg-shadow-mid rounded-full overflow-hidden relative">
        <motion.div
          className={clsx(
            "h-full bg-gradient-to-r rounded-full",
            gradient,
            glow,
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
