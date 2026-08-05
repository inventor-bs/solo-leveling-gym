"use client";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { RankBadge } from "@/components/ui/RankBadge";
import { StatBar } from "@/components/ui/StatBar";
import { ShadowParticles } from "@/components/ui/ShadowParticles";
import { useSystemToast } from "@/components/ui/SystemToast";
import Link from "next/link";
import { Flame, Swords, Clock, TrendingUp, Zap, Shield } from "lucide-react";

export default function DashboardPage() {
  const { hunterName, rank, level, currentExp, maxExp, gold, title, stats, quests, streakDays, shadowArmy } = useAppStore();
  const toast = useSystemToast();
  const expPct = Math.round((currentExp / maxExp) * 100);
  const mainQuest = quests.find((q) => q.type === "main");
  const sideQuests = quests.filter((q) => q.type === "side");
  const activeSoldiers = shadowArmy.filter((s) => s.unlocked && s.lastTrained);

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — MAIN HUD</p>
            <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
              Welcome back, <span className="text-system-blue">{hunterName}</span>
            </h1>
            <p className="font-mono text-sm text-slate-400 mt-1 italic">&quot;{title}&quot;</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="system-panel rounded-lg px-3 py-2 border border-gold/30">
              <div className="system-panel-inner flex items-center gap-2">
                <span className="text-gold text-sm">💰</span>
                <span className="font-mono text-gold font-bold">{gold.toLocaleString()} G</span>
              </div>
            </div>
            <RankBadge rank={rank} size="md" />
          </div>
        </motion.div>

        {/* Top row: Character + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Character Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SystemPanel header="HUNTER STATUS" className="h-full">
              <div className="p-4 space-y-4">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-monarch-purple via-shadow-mid to-void
                      border-2 border-system-blue/40 flex items-center justify-center text-3xl shadow-system animate-float">
                      🌑
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-shadow-dark rounded-full border border-system-blue/40
                      flex items-center justify-center font-mono text-xs text-system-blue font-bold">
                      {level}
                    </div>
                  </div>
                  <div>
                    <p className="font-cinzel text-lg font-bold text-white">{hunterName}</p>
                    <RankBadge rank={rank} size="sm" />
                    <p className="font-mono text-xs text-slate-500 mt-1">Level {level} Hunter</p>
                  </div>
                </div>

                {/* EXP */}
                <div>
                  <div className="flex justify-between font-mono text-xs text-system-blue/60 mb-1">
                    <span>EXPERIENCE</span>
                    <span>{currentExp.toLocaleString()} / {maxExp.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-shadow-mid rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-system-blue to-monarch-purple"
                      style={{ boxShadow: "0 0 8px rgba(0,212,255,0.6)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${expPct}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                  <p className="font-mono text-xs text-slate-500 mt-1 text-right">{expPct}% to Level {level + 1}</p>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <Flame className="text-warning w-5 h-5" />
                  <div>
                    <p className="font-mono text-sm font-bold text-warning">{streakDays} Day Streak</p>
                    <p className="font-mono text-xs text-slate-500">Consecutive training</p>
                  </div>
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/dungeon">
                    <button className="w-full py-2 px-3 rounded-lg bg-system-blue/10 border border-system-blue/30
                      font-mono text-xs text-system-blue hover:bg-system-blue/20 transition-all flex items-center gap-1 justify-center">
                      <Swords size={12} /> Enter Dungeon
                    </button>
                  </Link>
                  <Link href="/status">
                    <button className="w-full py-2 px-3 rounded-lg bg-monarch-purple/10 border border-monarch-purple/30
                      font-mono text-xs text-monarch-light hover:bg-monarch-purple/20 transition-all flex items-center gap-1 justify-center">
                      <Shield size={12} /> View Status
                    </button>
                  </Link>
                </div>
              </div>
            </SystemPanel>
          </motion.div>

          {/* Stats Panel */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <SystemPanel header="STAT WINDOW" className="h-full">
              <div className="p-4 space-y-3">
                <StatBar label="Strength"     shortLabel="STR" value={stats.strength}     delay={0.1} />
                <StatBar label="Agility"      shortLabel="AGI" value={stats.agility}      delay={0.2} />
                <StatBar label="Vitality"     shortLabel="VIT" value={stats.vitality}     delay={0.3} />
                <StatBar label="Intelligence" shortLabel="INT" value={stats.intelligence} delay={0.4} />
                <StatBar label="Perception"   shortLabel="PER" value={stats.perception}   delay={0.5} />
                <StatBar label="Luck"         shortLabel="LUK" value={stats.luck}         delay={0.6} />
                <div className="pt-2 border-t border-system-blue/20 flex justify-between items-center">
                  <span className="font-mono text-xs text-slate-500">Available Stat Points</span>
                  <span className="font-mono text-sm font-bold text-gold">{useAppStore.getState().statPoints} pts</span>
                </div>
              </div>
            </SystemPanel>
          </motion.div>
        </div>

        {/* Daily Quest */}
        {mainQuest && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <SystemPanel header="DAILY QUEST — MAIN" glowColor="purple" className="">
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-cinzel text-lg font-bold text-white">{mainQuest.title}</h3>
                    <p className="font-mono text-xs text-slate-400 mt-1 italic">{mainQuest.systemMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Clock size={14} className="text-warning" />
                    <span className="font-mono text-xs text-warning">{mainQuest.expiresIn}h remaining</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {mainQuest.requirements.map((req, i) => {
                    const pct = Math.min((req.current / req.total) * 100, 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between font-mono text-xs text-slate-300 mb-1">
                          <span>◈ {req.label}</span>
                          <span>{req.current} / {req.total} {req.unit}</span>
                        </div>
                        <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-monarch-purple to-system-blue rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-success">+{mainQuest.reward.exp} EXP</span>
                    <span className="font-mono text-xs text-gold">+{mainQuest.reward.gold} G</span>
                    {mainQuest.reward.stat && (
                      <span className="font-mono text-xs text-monarch-light">{mainQuest.reward.stat}</span>
                    )}
                  </div>
                  <Link href="/dungeon">
                    <button className="px-4 py-2 rounded-lg bg-monarch-purple/20 border border-monarch-purple/40
                      font-mono text-xs text-monarch-light hover:bg-monarch-purple/30 transition-all">
                      Enter Dungeon →
                    </button>
                  </Link>
                </div>
              </div>
            </SystemPanel>
          </motion.div>
        )}

        {/* Bottom row: Side Quests + Shadow Army preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Side Quests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SystemPanel header="SIDE QUESTS" className="h-full">
              <div className="p-4 space-y-3">
                {sideQuests.map((q) => {
                  const pct = (q.requirements[0].current / q.requirements[0].total) * 100;
                  return (
                    <div key={q.id} className="p-3 rounded-lg bg-shadow-mid/50 border border-system-blue/10 hover:border-system-blue/30 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-white font-medium">{q.title}</span>
                        <span className="font-mono text-xs text-success">+{q.reward.exp} EXP</span>
                      </div>
                      <div className="h-1.5 bg-shadow-dark rounded-full overflow-hidden">
                        <div className="h-full bg-system-blue/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between font-mono text-xs text-slate-500 mt-1">
                        <span>{q.requirements[0].label}</span>
                        <span>{q.requirements[0].current}/{q.requirements[0].total} {q.requirements[0].unit}</span>
                      </div>
                    </div>
                  );
                })}
                <Link href="/quests">
                  <button className="w-full py-2 font-mono text-xs text-system-blue/60 hover:text-system-blue border border-system-blue/10 hover:border-system-blue/30 rounded-lg transition-all">
                    View All Quests →
                  </button>
                </Link>
              </div>
            </SystemPanel>
          </motion.div>

          {/* Shadow Army Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <SystemPanel header="SHADOW ARMY" className="h-full">
              <div className="p-4">
                <p className="font-mono text-xs text-slate-500 mb-3">
                  {activeSoldiers.length} / {shadowArmy.length} soldiers active
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {shadowArmy.slice(0, 6).map((s) => (
                    <div
                      key={s.id}
                      className={`p-2 rounded-lg text-center border transition-all ${
                        s.unlocked
                          ? "bg-shadow-mid border-system-blue/20 hover:border-system-blue/40"
                          : "bg-shadow-dark border-slate-800 opacity-40"
                      }`}
                    >
                      <div className="text-xl mb-1">{s.icon}</div>
                      <p className="font-mono text-xs text-white truncate">{s.name}</p>
                      <p className="font-mono text-xs text-system-blue">Lv.{s.level}</p>
                      <p className="font-mono text-xs text-slate-500 truncate">{s.muscleGroup}</p>
                    </div>
                  ))}
                </div>
                <Link href="/shadow-army">
                  <button className="w-full mt-3 py-2 font-mono text-xs text-system-blue/60 hover:text-system-blue border border-system-blue/10 hover:border-system-blue/30 rounded-lg transition-all">
                    Manage Shadow Army →
                  </button>
                </Link>
              </div>
            </SystemPanel>
          </motion.div>
        </div>

        {/* System notification demo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-2 flex-wrap"
        >
          <button
            onClick={() => toast.success("Shadow soldier Igris has leveled up! Lv.7 → Lv.8")}
            className="px-3 py-1.5 text-xs font-mono text-success border border-success/30 rounded-lg hover:bg-success/10 transition-all"
          >
            ✦ Test Level Up
          </button>
          <button
            onClick={() => toast.warn("Daily quest expires in 2 hours. Complete or face the Penalty Zone.")}
            className="px-3 py-1.5 text-xs font-mono text-warning border border-warning/30 rounded-lg hover:bg-warning/10 transition-all"
          >
            ⚠ Test Warning
          </button>
          <button
            onClick={() => toast.danger("EMERGENCY QUEST ISSUED. The System demands action NOW.")}
            className="px-3 py-1.5 text-xs font-mono text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition-all"
          >
            ⚡ Test Emergency
          </button>
        </motion.div>
      </div>
    </div>
  );
}
