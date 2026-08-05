"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { ShadowParticles } from "@/components/ui/ShadowParticles";
import { Clock, CheckCircle, Lock, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const QUEST_TYPE_STYLE = {
  main:      { label: "MAIN QUEST",      color: "text-monarch-light", border: "border-monarch-purple/40",  bg: "bg-monarch-purple/5",  icon: "⚔️" },
  side:      { label: "SIDE QUEST",      color: "text-system-blue",   border: "border-system-blue/30",     bg: "bg-system-blue/5",     icon: "◈" },
  hidden:    { label: "HIDDEN QUEST",    color: "text-slate-400",     border: "border-slate-700",          bg: "bg-shadow-mid/50",     icon: "❓" },
  emergency: { label: "EMERGENCY",       color: "text-danger",        border: "border-danger/50",          bg: "bg-danger/5",          icon: "⚡" },
};

export default function QuestsPage() {
  const { quests, streakDays, completeQuest } = useAppStore();
  const [completing, setCompleting] = useState<string | null>(null);

  const handleComplete = (id: string) => {
    setCompleting(id);
    setTimeout(() => {
      completeQuest(id);
      setCompleting(null);
    }, 800);
  };

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — QUEST BOARD</p>
          <h1 className="font-cinzel text-3xl font-black text-white">DAILY QUESTS</h1>
          <p className="font-mono text-sm text-slate-400 mt-1">
            ⚠ Failure to complete quests will result in appropriate punishment.
          </p>
        </motion.div>

        {/* Streak + timer */}
        <motion.div
          className="grid grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="system-panel rounded-xl p-4 border border-warning/30 flex items-center gap-3">
            <div className="system-panel-inner flex items-center gap-3 w-full">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="font-mono text-xl font-bold text-warning">{streakDays} DAYS</p>
                <p className="font-mono text-xs text-slate-500">Current streak</p>
              </div>
            </div>
          </div>
          <div className="system-panel rounded-xl p-4 border border-danger/30 flex items-center gap-3">
            <div className="system-panel-inner flex items-center gap-3 w-full">
              <Clock className="text-danger w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-mono text-xl font-bold text-danger">18:24:33</p>
                <p className="font-mono text-xs text-slate-500">Until reset</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quests list */}
        <div className="space-y-4">
          {quests.map((quest, idx) => {
            const style = QUEST_TYPE_STYLE[quest.type];
            const isHidden = quest.type === "hidden";
            const totalProgress = quest.requirements.reduce((acc, r) => acc + (r.current / r.total), 0) / quest.requirements.length;

            return (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.08 }}
              >
                <SystemPanel
                  glowColor={quest.type === "main" ? "purple" : quest.type === "emergency" ? "danger" : "blue"}
                  className={clsx(style.bg, "border", style.border, quest.completed && "opacity-50")}
                >
                  <div className="p-4">
                    {/* Quest header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span>{style.icon}</span>
                        <span className={clsx("font-mono text-xs tracking-wider", style.color)}>{style.label}</span>
                      </div>
                      {quest.completed ? (
                        <span className="flex items-center gap-1 font-mono text-xs text-success">
                          <CheckCircle size={12} /> COMPLETED
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {quest.expiresIn}h left
                        </span>
                      )}
                    </div>

                    <h3 className="font-cinzel text-base font-bold text-white mb-1">
                      {isHidden && !quest.completed ? "???" : quest.title}
                    </h3>
                    <p className="font-mono text-xs text-slate-400 italic mb-4">
                      {isHidden && !quest.completed ? "Conditions unknown. The System watches." : quest.description}
                    </p>

                    {/* Requirements */}
                    {!isHidden && (
                      <div className="space-y-2 mb-4">
                        {quest.requirements.map((req, i) => {
                          const pct = Math.min((req.current / req.total) * 100, 100);
                          return (
                            <div key={i}>
                              <div className="flex justify-between font-mono text-xs text-slate-300 mb-1">
                                <span>◈ {req.label}</span>
                                <span>{req.current} / {req.total} {req.unit}</span>
                              </div>
                              <div className="h-1.5 bg-shadow-dark rounded-full overflow-hidden">
                                <motion.div
                                  className={clsx(
                                    "h-full rounded-full",
                                    quest.type === "main" ? "bg-gradient-to-r from-monarch-purple to-system-blue" : "bg-system-blue/70"
                                  )}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Rewards + action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-success">+{quest.reward.exp} EXP</span>
                        <span className="font-mono text-xs text-gold">+{quest.reward.gold} G</span>
                        {quest.reward.stat && (
                          <span className="font-mono text-xs text-monarch-light">{quest.reward.stat}</span>
                        )}
                      </div>
                      {!quest.completed && !isHidden && (
                        <motion.button
                          onClick={() => handleComplete(quest.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={clsx(
                            "px-4 py-1.5 rounded-lg font-mono text-xs transition-all",
                            quest.type === "main"
                              ? "bg-monarch-purple/30 border border-monarch-purple/50 text-monarch-light hover:bg-monarch-purple/50"
                              : "bg-system-blue/20 border border-system-blue/40 text-system-blue hover:bg-system-blue/30",
                            completing === quest.id && "animate-pulse"
                          )}
                        >
                          {completing === quest.id ? "Completing..." : "MARK COMPLETE"}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </SystemPanel>
              </motion.div>
            );
          })}
        </div>

        {/* Penalty Zone warning */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="system-panel rounded-xl p-4 border border-danger/30 bg-danger/5 danger-pulse"
        >
          <div className="system-panel-inner flex items-center gap-3">
            <AlertTriangle className="text-danger w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-mono text-xs text-danger font-bold tracking-widest">PENALTY ZONE WARNING</p>
              <p className="font-mono text-xs text-slate-400 mt-0.5">
                Failure to complete the Main Quest before reset will activate the Penalty Zone Protocol.
                The System shows no mercy.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
