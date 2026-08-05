"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/ui/stores/useAppStore";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import clsx from "clsx";

const STORE_ITEMS = [
  { id: "hp-low",     name: "Low-Grade HP Potion",       type: "consumable", grade: "common",    price: 50,   icon: "💊", effect: "Restore HP +100. Reduce DOMS." },
  { id: "hp-mid",     name: "Mid-Grade HP Potion",       type: "consumable", grade: "uncommon",  price: 200,  icon: "💊", effect: "Restore HP +200. Accelerate recovery." },
  { id: "hp-high",    name: "High-Grade HP Potion",      type: "consumable", grade: "rare",      price: 500,  icon: "💊", effect: "Full recovery. STR +1 for 24h." },
  { id: "mana",       name: "Mana Elixir",               type: "consumable", grade: "rare",      price: 300,  icon: "🧪", effect: "Pre-workout boost. Performance +15%." },
  { id: "protein",    name: "High-Protein Concentrate",  type: "consumable", grade: "common",    price: 40,   icon: "🥛", effect: "+25g protein. STR recovery." },
  { id: "creatine",   name: "Strength Compound",         type: "consumable", grade: "uncommon",  price: 150,  icon: "⚗️", effect: "STR +3 for 7 days." },
  { id: "grips",      name: "Iron Grips",                type: "equipment",  grade: "rare",      price: 800,  icon: "🧤", effect: "Deadlift grip +20%. Back engagement +10%." },
  { id: "belt",       name: "Shadow Power Belt",         type: "equipment",  grade: "epic",      price: 2500, icon: "🦺", effect: "Core stability +25%. Unlock heavy lift quests." },
  { id: "form-scroll",name: "Form Codex — Squat",        type: "special",    grade: "epic",      price: 1500, icon: "📜", effect: "Master squat form. INT +5, LUK +2." },
  { id: "dungeon-key",name: "S-Rank Gate Key",           type: "special",    grade: "legendary", price: 5000, icon: "🔑", effect: "Unlock S-Rank dungeon. Reward multiplied ×3." },
];

const GRADE_COLOR: Record<string, string> = {
  common:    "text-slate-400",
  uncommon:  "text-rank-d",
  rare:      "text-rank-c",
  epic:      "text-rank-b",
  legendary: "text-rank-s",
};

const GRADE_BG: Record<string, string> = {
  common:    "bg-slate-900/50 border-slate-700",
  uncommon:  "bg-rank-d/5 border-rank-d/30",
  rare:      "bg-rank-c/5 border-rank-c/30",
  epic:      "bg-rank-b/5 border-rank-b/30",
  legendary: "bg-rank-s/5 border-rank-s/40",
};

export default function StorePage() {
  const { gold } = useAppStore();
  const [tab, setTab] = useState<"consumable" | "equipment" | "special">("consumable");
  const [buying, setBuying] = useState<string | null>(null);

  const items = STORE_ITEMS.filter((i) => i.type === tab);

  const handleBuy = (id: string, price: number) => {
    if (gold < price) return;
    setBuying(id);
    setTimeout(() => setBuying(null), 600);
  };

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — EXCHANGE STORE</p>
          <div className="flex items-center justify-between">
            <h1 className="font-cinzel text-3xl font-black text-white">SYSTEM STORE</h1>
            <motion.div
              className="system-panel rounded-lg px-4 py-2 border border-gold/40"
              animate={{ boxShadow: ["0 0 10px rgba(255,215,0,0.2)", "0 0 20px rgba(255,215,0,0.4)", "0 0 10px rgba(255,215,0,0.2)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="system-panel-inner flex items-center gap-2">
                <span>💰</span>
                <span className="font-mono text-gold font-bold text-lg">{gold.toLocaleString()} G</span>
              </div>
            </motion.div>
          </div>
          <p className="font-mono text-xs text-slate-500 mt-1">
            Items are manifestations of mana. Only the Player can perceive this store.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {(["consumable", "equipment", "special"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "px-5 py-2 rounded-lg font-mono text-xs tracking-wider transition-all capitalize",
                tab === t
                  ? "bg-system-blue/20 border border-system-blue/50 text-system-blue shadow-system"
                  : "border border-slate-700 text-slate-500 hover:border-system-blue/30"
              )}
            >
              {t}
            </button>
          ))}
        </motion.div>

        {/* Items list */}
        <div className="space-y-2">
          {items.map((item, i) => {
            const canAfford = gold >= item.price;
            const isBuying = buying === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className={clsx(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  GRADE_BG[item.grade],
                  canAfford && "hover:border-opacity-60",
                  !canAfford && "opacity-50",
                )}>
                  <span className="text-3xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={clsx("font-cinzel text-sm font-bold truncate", GRADE_COLOR[item.grade])}>
                        {item.name}
                      </h3>
                      <span className={clsx("font-mono text-xs uppercase tracking-wider flex-shrink-0", GRADE_COLOR[item.grade])}>
                        [{item.grade}]
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-500 truncate">{item.effect}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-sm font-bold text-gold">{item.price.toLocaleString()} G</span>
                    <motion.button
                      onClick={() => handleBuy(item.id, item.price)}
                      whileHover={canAfford ? { scale: 1.05 } : {}}
                      whileTap={canAfford ? { scale: 0.95 } : {}}
                      className={clsx(
                        "px-4 py-1.5 rounded-lg font-mono text-xs transition-all",
                        canAfford
                          ? "bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
                          : "bg-shadow-dark border border-slate-800 text-slate-600 cursor-not-allowed",
                        isBuying && "animate-pulse bg-gold/40"
                      )}
                    >
                      {isBuying ? "BUYING..." : "BUY"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Sell info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="system-panel rounded-xl p-3 border border-system-blue/10"
        >
          <div className="system-panel-inner">
            <p className="font-mono text-xs text-slate-500 text-center">
              ◈ To sell items, visit your Inventory and select an item.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
