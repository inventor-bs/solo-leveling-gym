"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useAppStore } from "@/ui/stores/useAppStore";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { RankBadge } from "@/ui/components/primitives/RankBadge";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import { CheckCircle2, Circle, Timer } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

function DungeonEntryScreen({ onEnter }: { onEnter: () => void }) {
  const { activeDungeon } = useAppStore();
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-void overflow-hidden">
      <ShadowParticles />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(123,47,190,0.2)_0%,transparent_70%)]" />

      <motion.div
        className="relative z-10 max-w-lg w-full mx-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <SystemPanel glowColor="purple" className="text-center">
          <div className="p-8 space-y-6">
            {/* Icon */}
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-6xl"
            >
              🌑
            </motion.div>

            <div>
              <p className="font-mono text-xs text-system-blue tracking-widest mb-3">◈ GATE DETECTED</p>
              <h2 className="font-cinzel text-xl font-black text-white mb-1">{activeDungeon.name}</h2>
              <RankBadge rank={activeDungeon.rank} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { label: "TYPE", value: activeDungeon.type },
                { label: "EXERCISES", value: `${activeDungeon.exercises.length} movements` },
                { label: "ESTIMATED", value: "60-75 min" },
                { label: "BOSS", value: "Bench Press PR" },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 bg-shadow-mid rounded-lg border border-system-blue/10">
                  <p className="font-mono text-xs text-slate-500">{label}</p>
                  <p className="font-mono text-xs text-white font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
              <p className="font-mono text-xs text-warning">
                ⚠ Once entered, the dungeon cannot be abandoned without penalty.
              </p>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={onEnter}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 py-3 px-6 rounded-lg bg-monarch-purple font-cinzel font-bold text-white
                  tracking-wider shadow-purple hover:bg-monarch-light transition-all"
              >
                ⚔ ENTER DUNGEON
              </motion.button>
            </div>
          </div>
        </SystemPanel>
      </motion.div>
    </div>
  );
}

function CompletionOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <ShadowParticles />
      <motion.div
        className="relative z-10 text-center max-w-md mx-4"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 12 }}
      >
        <motion.div
          className="text-8xl mb-6"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          ✦
        </motion.div>

        <h2 className="font-cinzel text-4xl font-black shimmer-text mb-2">DUNGEON CLEAR</h2>
        <p className="font-mono text-system-blue text-sm tracking-wider mb-6">QUEST COMPLETE</p>

        <SystemPanel glowColor="gold" className="mb-6">
          <div className="p-4 space-y-3">
            {[
              { label: "EXP Gained",    value: "+450 EXP",    color: "text-success" },
              { label: "Gold Gained",   value: "+75 G",       color: "text-gold" },
              { label: "Stat Gained",   value: "STR +3",      color: "text-orange-400" },
              { label: "Shadow XP",     value: "Igris +120",  color: "text-monarch-light" },
              { label: "Item Drop",     value: "Mid-Grade Potion", color: "text-rank-c" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="font-mono text-xs text-slate-400">{label}</span>
                <span className={clsx("font-mono text-sm font-bold", color)}>{value}</span>
              </div>
            ))}
          </div>
        </SystemPanel>

        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-8 py-3 bg-system-blue rounded-lg font-cinzel font-bold text-void tracking-wider shadow-system"
        >
          COLLECT REWARDS
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default function DungeonPage() {
  const { activeDungeon, toggleSet, startDungeon, completeDungeon } = useAppStore();
  const [elapsed, setElapsed] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!activeDungeon.active || !activeDungeon.startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeDungeon.startTime!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeDungeon.active, activeDungeon.startTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const totalSets = activeDungeon.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const completedSets = activeDungeon.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  const handleComplete = () => {
    completeDungeon();
    setShowComplete(true);
  };

  if (!activeDungeon.active) {
    return <DungeonEntryScreen onEnter={startDungeon} />;
  }

  return (
    <div className="relative min-h-screen bg-void p-4 md:p-6">
      <ShadowParticles />
      <AnimatePresence>{showComplete && <CompletionOverlay onClose={() => { setShowComplete(false); router.push("/dashboard"); }} />}</AnimatePresence>

      <div className="relative z-10 max-w-3xl mx-auto space-y-4">
        {/* Dungeon HUD */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <SystemPanel glowColor="purple">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-monarch-light tracking-widest">◈ DUNGEON ACTIVE</p>
                  <h2 className="font-cinzel text-sm font-bold text-white mt-0.5">{activeDungeon.name}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <RankBadge rank={activeDungeon.rank} size="sm" />
                  <div className="flex items-center gap-1 text-warning font-mono text-sm">
                    <Timer size={14} />
                    <span>{formatTime(elapsed)}</span>
                  </div>
                </div>
              </div>

              {/* Overall progress */}
              <div>
                <div className="flex justify-between font-mono text-xs text-system-blue/60 mb-1">
                  <span>DUNGEON PROGRESS</span>
                  <span>{completedSets} / {totalSets} sets</span>
                </div>
                <div className="h-2 bg-shadow-dark rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-monarch-purple to-system-blue rounded-full"
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.3 }}
                    style={{ boxShadow: "0 0 8px rgba(0,212,255,0.5)" }}
                  />
                </div>
              </div>
            </div>
          </SystemPanel>
        </motion.div>

        {/* Exercises */}
        <div className="space-y-3">
          {activeDungeon.exercises.map((exercise, exIdx) => {
            const exCompleted = exercise.sets.every((s) => s.completed);
            return (
              <motion.div
                key={exercise.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: exIdx * 0.1 }}
              >
                <SystemPanel
                  glowColor={exCompleted ? "gold" : "blue"}
                  className={clsx(exCompleted && "border-gold/30 bg-gold/5")}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className={clsx("font-cinzel text-base font-bold", exCompleted ? "text-gold" : "text-white")}>
                          {exercise.name}
                        </h3>
                        <p className="font-mono text-xs text-slate-500">{exercise.targetMuscle}</p>
                      </div>
                      {exCompleted && <CheckCircle2 className="text-gold w-5 h-5" />}
                    </div>

                    {/* Sets grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {exercise.sets.map((set, setIdx) => (
                        <motion.button
                          key={setIdx}
                          onClick={() => toggleSet(exercise.id, setIdx)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.92 }}
                          className={clsx(
                            "p-3 rounded-lg border text-center transition-all duration-200",
                            set.completed
                              ? "bg-success/15 border-success/40 shadow-[0_0_8px_rgba(0,255,136,0.3)]"
                              : "bg-shadow-mid border-system-blue/20 hover:border-system-blue/50"
                          )}
                        >
                          <div className="flex items-center justify-center mb-1">
                            {set.completed
                              ? <CheckCircle2 className="text-success w-4 h-4" />
                              : <Circle className="text-slate-600 w-4 h-4" />}
                          </div>
                          <p className="font-mono text-xs text-white font-bold">Set {setIdx + 1}</p>
                          <p className="font-mono text-xs text-slate-400">{set.reps} × {set.weight}kg</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </SystemPanel>
              </motion.div>
            );
          })}
        </div>

        {/* Complete dungeon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: progress > 0.5 ? 1 : 0.4 }}
          className="pb-6"
        >
          <motion.button
            onClick={handleComplete}
            whileHover={progress > 0.5 ? { scale: 1.02 } : {}}
            whileTap={progress > 0.5 ? { scale: 0.98 } : {}}
            className={clsx(
              "w-full py-4 rounded-xl font-cinzel font-black text-lg tracking-wider transition-all",
              progress >= 1
                ? "bg-gold text-void shadow-gold animate-glow-pulse"
                : progress > 0.5
                ? "bg-monarch-purple/30 border border-monarch-purple/50 text-monarch-light hover:bg-monarch-purple/50"
                : "bg-shadow-mid border border-slate-700 text-slate-600 cursor-not-allowed"
            )}
          >
            {progress >= 1 ? "⚔ DEFEAT THE BOSS — DUNGEON CLEAR" : "⚔ COMPLETE DUNGEON"}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
