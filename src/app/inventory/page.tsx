"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAppStore, type InventoryItem } from "@/ui/stores/useAppStore";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import clsx from "clsx";

type ItemGrade = InventoryItem["grade"];

/**
 * Keyed by the grade union rather than `string`, so every lookup is total —
 * no `undefined` to guard against at each call site.
 */
const GRADE_STYLE: Record<ItemGrade, string> = {
  common: "border-slate-600    text-slate-400     bg-slate-900/50",
  uncommon: "border-rank-d/50   text-rank-d        bg-rank-d/10",
  rare: "border-rank-c/50   text-rank-c        bg-rank-c/10",
  epic: "border-rank-b/50   text-rank-b        bg-rank-b/10",
  legendary: "border-rank-s/50   text-rank-s        bg-rank-s/10",
};

const GRADE_GLOW: Record<ItemGrade, string> = {
  common: "",
  uncommon: "hover:shadow-[0_0_10px_rgba(74,222,128,0.3)]",
  rare: "hover:shadow-[0_0_10px_rgba(96,165,250,0.3)]",
  epic: "hover:shadow-[0_0_10px_rgba(167,139,250,0.4)]",
  legendary: "hover:shadow-[0_0_14px_rgba(255,107,53,0.5)]",
};

export default function InventoryPage() {
  const { inventory, gold } = useAppStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "consumable" | "equipment" | "special"
  >("all");

  const selectedItem = inventory.find((i) => i.id === selected);
  const filtered =
    filter === "all" ? inventory : inventory.filter((i) => i.type === filter);

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — INVENTORY
          </p>
          <div className="flex items-center justify-between">
            <h1 className="font-cinzel text-3xl font-black text-white">
              INVENTORY
            </h1>
            <div className="system-panel rounded-lg px-4 py-2 border border-gold/30 flex items-center gap-2">
              <div className="system-panel-inner flex items-center gap-2">
                <span className="text-gold">💰</span>
                <span className="font-mono text-gold font-bold">
                  {gold.toLocaleString()} G
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          className="flex gap-2 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {(["all", "consumable", "equipment", "special"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-4 py-1.5 rounded-lg font-mono text-xs tracking-wider transition-all capitalize",
                filter === f
                  ? "bg-system-blue/20 border border-system-blue/50 text-system-blue"
                  : "border border-slate-700 text-slate-500 hover:border-system-blue/30 hover:text-slate-300",
              )}
            >
              {f}
            </button>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid */}
          <div className="lg:col-span-2">
            <SystemPanel header={`ITEMS (${filtered.length})`}>
              <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filtered.map((item, i) => {
                  const isSelected = selected === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelected(isSelected ? null : item.id)}
                      className={clsx(
                        "relative aspect-square rounded-lg border p-2 flex flex-col items-center justify-center gap-1 transition-all",
                        GRADE_STYLE[item.grade],
                        GRADE_GLOW[item.grade],
                        isSelected && "ring-1 ring-system-blue shadow-system",
                      )}
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <p
                        className="font-mono text-xs text-center leading-tight line-clamp-2"
                        style={{ fontSize: "9px" }}
                      >
                        {item.name}
                      </p>
                      {item.quantity > 1 && (
                        <span className="absolute bottom-1 right-1.5 font-mono text-xs font-bold text-white">
                          ×{item.quantity}
                        </span>
                      )}
                      <span
                        className={clsx(
                          "absolute top-1 right-1 font-mono text-[8px] uppercase tracking-wider",
                          GRADE_STYLE[item.grade].split(" ")[1],
                        )}
                      >
                        {item.grade.charAt(0).toUpperCase()}
                      </span>
                    </motion.button>
                  );
                })}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 12 - filtered.length) }).map(
                  (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square rounded-lg border border-slate-800/50 bg-shadow-dark/30"
                    />
                  ),
                )}
              </div>
            </SystemPanel>
          </div>

          {/* Item detail */}
          <div>
            <AnimatePresence mode="wait">
              {selectedItem ? (
                <motion.div
                  key={selectedItem.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <SystemPanel header="ITEM DETAIL" className="sticky top-6">
                    <div className="p-4 space-y-4 text-center">
                      <motion.div
                        className="text-6xl"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        {selectedItem.icon}
                      </motion.div>

                      <div>
                        <h3
                          className={clsx(
                            "font-cinzel text-sm font-bold",
                            GRADE_STYLE[selectedItem.grade].split(" ")[1],
                          )}
                        >
                          {selectedItem.name}
                        </h3>
                        <span
                          className={clsx(
                            "font-mono text-xs border px-2 py-0.5 rounded mt-1 inline-block capitalize",
                            GRADE_STYLE[selectedItem.grade],
                          )}
                        >
                          {selectedItem.grade}
                        </span>
                      </div>

                      <div className="space-y-2 text-left">
                        {[
                          { label: "TYPE", value: selectedItem.type },
                          {
                            label: "QUANTITY",
                            value: `×${selectedItem.quantity}`,
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between">
                            <span className="font-mono text-xs text-slate-500">
                              {label}
                            </span>
                            <span className="font-mono text-xs text-white capitalize">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-shadow-mid rounded-lg border border-system-blue/10 text-left">
                        <p className="font-mono text-xs text-slate-400">
                          {selectedItem.effect}
                        </p>
                      </div>

                      {selectedItem.type === "consumable" && (
                        <button className="w-full py-2 rounded-lg bg-success/10 border border-success/30 font-mono text-sm text-success hover:bg-success/20 transition-all">
                          ✦ USE ITEM
                        </button>
                      )}
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
                      <p className="font-mono text-xs text-slate-600">
                        Select an item to view details
                      </p>
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
