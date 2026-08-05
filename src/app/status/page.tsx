"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/ui/stores/useAppStore";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { StatBar } from "@/ui/components/primitives/StatBar";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import { Zap } from "lucide-react";

const STAT_KEYS = [
  { key: "strength",     label: "Strength",     short: "STR", desc: "Physical power — lifting capacity, muscle mass" },
  { key: "agility",      label: "Agility",       short: "AGI", desc: "Speed, cardio fitness, reaction time" },
  { key: "vitality",     label: "Vitality",      short: "VIT", desc: "Endurance, consistency, recovery rate" },
  { key: "intelligence", label: "Intelligence",  short: "INT", desc: "Nutrition knowledge, form accuracy" },
  { key: "perception",   label: "Perception",    short: "PER", desc: "Mind-muscle connection, body awareness" },
  { key: "luck",         label: "Luck",          short: "LUK", desc: "Random bonus events, surprise drops" },
] as const;

export default function StatusPage() {
  const { hunterName, rank, level, currentExp, maxExp, gold, title, stats, statPoints } = useAppStore();
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — STATUS WINDOW</p>
          <h1 className="font-cinzel text-3xl font-black text-white">HUNTER STATUS</h1>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Character Info */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <SystemPanel header="PLAYER INFO" glowColor="blue" className="h-full">
              <div className="p-5 space-y-5">
                {/* Avatar section */}
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <motion.div
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-monarch-purple via-shadow-mid to-void
                        border-2 border-system-blue/50 flex items-center justify-center text-4xl shadow-system"
                      animate={{ boxShadow: ["0 0 20px rgba(0,212,255,0.3)", "0 0 40px rgba(0,212,255,0.6)", "0 0 20px rgba(0,212,255,0.3)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      🌑
                    </motion.div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-cinzel text-xl font-bold text-white">{hunterName}</p>
                    <RankBadge rank={rank} size="md" />
                    <p className="font-mono text-sm text-slate-400 italic">&quot;{title}&quot;</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-system-blue/20 pt-4">
                  {[
                    { label: "JOB CLASS", value: "Shadow Monarch" },
                    { label: "LEVEL", value: `${level}` },
                    { label: "RANK", value: `${rank}-Rank` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="font-mono text-xs text-slate-500 tracking-wider">{label}</span>
                      <span className="font-mono text-sm text-white font-bold">{value}</span>
                    </div>
                  ))}
                </div>

                {/* EXP */}
                <div className="p-3 rounded-lg bg-shadow-mid border border-system-blue/10">
                  <div className="flex justify-between font-mono text-xs text-system-blue/60 mb-2">
                    <span>EXPERIENCE POINTS</span>
                    <span>{currentExp.toLocaleString()} / {maxExp.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 bg-shadow-dark rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
                      style={{ boxShadow: "0 0 8px rgba(0,212,255,0.6)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(currentExp / maxExp) * 100}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Gold */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gold/5 border border-gold/20">
                  <span className="font-mono text-xs text-gold tracking-wider">GOLD</span>
                  <span className="font-mono text-lg font-bold text-gold">{gold.toLocaleString()} G</span>
                </div>

                {/* Available points */}
                {statPoints > 0 && (
                  <motion.div
                    className="flex items-center gap-2 p-3 rounded-lg bg-success/5 border border-success/30"
                    animate={{ borderColor: ["rgba(0,255,136,0.3)", "rgba(0,255,136,0.6)", "rgba(0,255,136,0.3)"] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Zap className="text-success w-4 h-4" />
                    <span className="font-mono text-sm text-success">{statPoints} stat points available!</span>
                  </motion.div>
                )}
              </div>
            </SystemPanel>
          </motion.div>

          {/* Stats Window */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <SystemPanel header="STAT WINDOW" glowColor="blue" className="h-full">
              <div className="p-5 space-y-4">
                <p className="font-mono text-xs text-slate-500">
                  ◈ Hover a stat to view details
                </p>
                {STAT_KEYS.map(({ key, label, short, desc }, i) => (
                  <div
                    key={key}
                    className="relative cursor-pointer"
                    onMouseEnter={() => setHoveredStat(key)}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <StatBar
                      label={label}
                      shortLabel={short}
                      value={stats[key]}
                      delay={i * 0.08}
                    />
                    <AnimatePresence>
                      {hoveredStat === key && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 top-0 z-20 bg-shadow-dark border border-system-blue/40 rounded-lg p-2 max-w-[180px] text-right shadow-system"
                        >
                          <p className="font-mono text-xs text-slate-300">{desc}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                <div className="pt-2 border-t border-system-blue/20">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs text-slate-500">Total Power Rating</span>
                    <span className="font-mono text-base font-bold holo-text">
                      {Object.values(stats).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </SystemPanel>
          </motion.div>
        </div>

        {/* Titles & Achievements */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SystemPanel header="TITLES & ACHIEVEMENTS">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: "Knight of the Shadows", desc: "Reach B-Rank", earned: true, icon: "🌑" },
                { title: "Iron Will", desc: "12-day streak", earned: true, icon: "🔥" },
                { title: "Gate Slayer", desc: "Clear 10 dungeons", earned: true, icon: "⚔️" },
                { title: "Shadow Monarch", desc: "Reach Monarch rank", earned: false, icon: "👑" },
                { title: "Perfect Form", desc: "100 AI form score", earned: false, icon: "💎" },
                { title: "Arise", desc: "Raise 20 soldiers", earned: false, icon: "🌟" },
              ].map(({ title: t, desc, earned, icon }) => (
                <div key={t} className={`p-3 rounded-lg border flex items-center gap-3 ${
                  earned
                    ? "bg-shadow-mid border-gold/30"
                    : "bg-shadow-dark border-slate-800 opacity-50"
                }`}>
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className={`font-mono text-xs font-bold ${earned ? "text-gold" : "text-slate-600"}`}>{t}</p>
                    <p className="font-mono text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SystemPanel>
        </motion.div>
      </div>
    </div>
  );
}
