"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { ShadowParticles } from "@/components/ui/ShadowParticles";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";

const GRADE_COLOR: Record<string, string> = {
  "Elite Knight":    "text-rank-a border-rank-a/40 bg-rank-a/5",
  "Elite Warrior":   "text-rank-b border-rank-b/40 bg-rank-b/5",
  "Elite Guardian":  "text-rank-b border-rank-b/40 bg-rank-b/5",
  "Elite Assassin":  "text-rank-c border-rank-c/40 bg-rank-c/5",
  "Elite Berserker": "text-rank-c border-rank-c/40 bg-rank-c/5",
  "Shadow Mage":     "text-rank-d border-rank-d/40 bg-rank-d/5",
  "Shadow Dragon":   "text-rank-s border-rank-s/40 bg-rank-s/5",
  "Unknown":         "text-slate-600 border-slate-800 bg-shadow-dark",
};

function AriseAnimation({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ShadowParticles />
      <div className="text-center relative z-10">
        <motion.div
          className="text-8xl mb-6"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          🌑
        </motion.div>
        <motion.h2
          className="font-cinzel text-5xl font-black text-white mb-2"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          ARISE
        </motion.h2>
        <motion.p
          className="font-mono text-system-blue tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {name} has answered the call.
        </motion.p>
        <motion.button
          className="mt-8 px-6 py-2 border border-system-blue/40 rounded-lg font-mono text-sm text-system-blue hover:bg-system-blue/10 transition-all"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={onDone}
        >
          CONTINUE
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function ShadowArmyPage() {
  const { shadowArmy } = useAppStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [ariseTarget, setAriseTarget] = useState<string | null>(null);

  const selectedSoldier = shadowArmy.find((s) => s.id === selected);

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <AnimatePresence>
        {ariseTarget && (
          <AriseAnimation
            name={shadowArmy.find((s) => s.id === ariseTarget)?.name || ""}
            onDone={() => setAriseTarget(null)}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — SHADOW ARMY</p>
          <h1 className="font-cinzel text-3xl font-black text-white">SHADOW ARMY</h1>
          <p className="font-mono text-sm text-slate-400 mt-1">
            {shadowArmy.filter((s) => s.unlocked).length} soldiers under your command
          </p>
        </motion.div>

        {/* Arise button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <button
            onClick={() => setAriseTarget("igris")}
            className="px-8 py-3 font-cinzel font-black text-xl text-white bg-gradient-to-r from-monarch-purple to-shadow-dark border border-monarch-purple/50 rounded-xl shadow-purple hover:shadow-[0_0_40px_rgba(123,47,190,0.6)] transition-all animate-glow-pulse"
          >
            🌑 ARISE
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Soldiers grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shadowArmy.map((soldier, i) => {
                const isSelected = selected === soldier.id;
                const levelPct = (soldier.level / soldier.maxLevel) * 100;
                const needsTraining = soldier.unlocked && soldier.lastTrained &&
                  new Date(soldier.lastTrained).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000;

                return (
                  <motion.div
                    key={soldier.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => soldier.unlocked && setSelected(isSelected ? null : soldier.id)}
                    className={clsx(
                      "relative p-3 rounded-xl border cursor-pointer transition-all duration-200",
                      !soldier.unlocked && "opacity-40 cursor-not-allowed",
                      isSelected && "border-system-blue/60 shadow-system",
                      !isSelected && soldier.unlocked && "border-system-blue/20 hover:border-system-blue/40",
                      needsTraining && "border-danger/30 bg-danger/5",
                    )}
                  >
                    {needsTraining && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
                    )}

                    <div className="text-3xl text-center mb-2">{soldier.icon}</div>
                    <p className={clsx("font-cinzel text-sm font-bold text-center truncate", soldier.unlocked ? "text-white" : "text-slate-600")}>
                      {soldier.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500 text-center">{soldier.muscleGroup}</p>

                    {soldier.unlocked && (
                      <>
                        <p className="font-mono text-xs text-system-blue text-center mt-1">Lv.{soldier.level}</p>
                        <div className="mt-2 h-1 bg-shadow-dark rounded-full overflow-hidden">
                          <div className="h-full bg-system-blue/60 rounded-full" style={{ width: `${levelPct}%` }} />
                        </div>
                      </>
                    )}

                    {!soldier.unlocked && (
                      <p className="font-mono text-xs text-slate-700 text-center mt-1">LOCKED</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div>
            <AnimatePresence mode="wait">
              {selectedSoldier ? (
                <motion.div
                  key={selectedSoldier.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <SystemPanel header="SOLDIER DETAIL" glowColor="blue" className="sticky top-6">
                    <div className="p-4 space-y-4 text-center">
                      <motion.div
                        className="text-6xl"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {selectedSoldier.icon}
                      </motion.div>
                      <div>
                        <h3 className="font-cinzel text-lg font-bold text-white">{selectedSoldier.name}</h3>
                        <span className={clsx("font-mono text-xs border px-2 py-0.5 rounded mt-1 inline-block", GRADE_COLOR[selectedSoldier.grade])}>
                          {selectedSoldier.grade}
                        </span>
                      </div>

                      <div className="space-y-2 text-left">
                        {[
                          { label: "MUSCLE GROUP", value: selectedSoldier.muscleGroup },
                          { label: "LEVEL", value: `${selectedSoldier.level} / ${selectedSoldier.maxLevel}` },
                          {
                            label: "LAST TRAINED",
                            value: selectedSoldier.lastTrained
                              ? formatDistanceToNow(new Date(selectedSoldier.lastTrained), { addSuffix: true })
                              : "Never"
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between">
                            <span className="font-mono text-xs text-slate-500">{label}</span>
                            <span className="font-mono text-xs text-white">{value}</span>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="flex justify-between font-mono text-xs text-system-blue/60 mb-1">
                          <span>POWER LEVEL</span>
                          <span>{selectedSoldier.level}/{selectedSoldier.maxLevel}</span>
                        </div>
                        <div className="h-2 bg-shadow-dark rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
                            style={{ boxShadow: "0 0 6px rgba(0,212,255,0.6)" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(selectedSoldier.level / selectedSoldier.maxLevel) * 100}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => setAriseTarget(selectedSoldier.id)}
                        className="w-full py-2 rounded-lg bg-monarch-purple/20 border border-monarch-purple/40 font-mono text-sm text-monarch-light hover:bg-monarch-purple/30 transition-all"
                      >
                        🌑 COMMAND: ARISE
                      </button>
                    </div>
                  </SystemPanel>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <SystemPanel className="border-dashed border-system-blue/20">
                    <div className="p-8 text-center">
                      <p className="font-mono text-xs text-slate-600">Select a shadow soldier to view details</p>
                    </div>
                  </SystemPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
