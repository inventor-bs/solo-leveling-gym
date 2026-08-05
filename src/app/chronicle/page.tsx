"use client";
import { motion } from "framer-motion";
import { ShadowParticles } from "@/components/ui/ShadowParticles";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const WEEKLY_DATA = [
  { day: "Mon", str: 72, agi: 58, vit: 55 },
  { day: "Tue", str: 72, agi: 59, vit: 56 },
  { day: "Wed", str: 73, agi: 59, vit: 56 },
  { day: "Thu", str: 73, agi: 60, vit: 57 },
  { day: "Fri", str: 74, agi: 61, vit: 57 },
  { day: "Sat", str: 74, agi: 61, vit: 58 },
  { day: "Sun", str: 74, agi: 61, vit: 58 },
];

const DUNGEON_HISTORY = [
  { date: "Aug 4", name: "Catacombs of Iron — Chest", rank: "B", exp: 450, gold: 75 },
  { date: "Aug 3", name: "Forest of Shadows — Back",  rank: "B", exp: 420, gold: 70 },
  { date: "Aug 2", name: "Red Gate — Legs",           rank: "A", exp: 580, gold: 95 },
  { date: "Jul 31", name: "Mana Wasteland — Cardio",  rank: "C", exp: 280, gold: 45 },
  { date: "Jul 30", name: "Crystal Cave — Shoulders", rank: "B", exp: 390, gold: 65 },
];

const RANK_COLOR: Record<string, string> = {
  E: "text-rank-e", D: "text-rank-d", C: "text-rank-c",
  B: "text-rank-b", A: "text-rank-a", S: "text-rank-s",
};

export default function ChroniclePage() {
  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — CHRONICLE</p>
          <h1 className="font-cinzel text-3xl font-black text-white">CHRONICLE</h1>
          <p className="font-mono text-sm text-slate-400 mt-1">The record of the Shadow Monarch's journey.</p>
        </motion.div>

        {/* Stat graph */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SystemPanel header="STAT PROGRESSION — WEEKLY">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={WEEKLY_DATA}>
                  <defs>
                    <linearGradient id="gStr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAgi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gVit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[50, 80]} tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0D0D1A", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                    labelStyle={{ color: "#00D4FF" }}
                  />
                  <Area type="monotone" dataKey="str" stroke="#f97316" strokeWidth={2} fill="url(#gStr)" name="STR" />
                  <Area type="monotone" dataKey="agi" stroke="#4ade80" strokeWidth={2} fill="url(#gAgi)" name="AGI" />
                  <Area type="monotone" dataKey="vit" stroke="#60a5fa" strokeWidth={2} fill="url(#gVit)" name="VIT" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2">
                {[["STR","#f97316"],["AGI","#4ade80"],["VIT","#60a5fa"]].map(([k,c]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                    <span className="font-mono text-xs text-slate-400">{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </SystemPanel>
        </motion.div>

        {/* Personal Records */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SystemPanel header="PERSONAL RECORDS (PRs)">
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { exercise: "Bench Press", value: "85kg", date: "Aug 2" },
                { exercise: "Deadlift",    value: "120kg", date: "Jul 28" },
                { exercise: "Squat",       value: "100kg", date: "Jul 25" },
                { exercise: "5km Run",     value: "24:12", date: "Aug 1" },
                { exercise: "Pull-ups",    value: "15 reps", date: "Jul 30" },
                { exercise: "Plank",       value: "3:42",   date: "Jul 22" },
              ].map(({ exercise, value, date }) => (
                <div key={exercise} className="p-3 rounded-lg bg-gold/5 border border-gold/20 text-center">
                  <p className="font-mono text-xs text-slate-500">{exercise}</p>
                  <p className="font-cinzel text-lg font-black text-gold">{value}</p>
                  <p className="font-mono text-xs text-slate-600">{date}</p>
                </div>
              ))}
            </div>
          </SystemPanel>
        </motion.div>

        {/* Dungeon history */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SystemPanel header="DUNGEON HISTORY">
            <div className="p-3 space-y-2">
              {DUNGEON_HISTORY.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-shadow-mid/40 border border-system-blue/10 hover:border-system-blue/25 transition-all"
                >
                  <span className="text-xl">⚔️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-cinzel text-sm font-bold text-white truncate">{d.name}</p>
                    <p className="font-mono text-xs text-slate-500">{d.date}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right flex-shrink-0">
                    <span className={`font-mono text-xs font-bold ${RANK_COLOR[d.rank]}`}>[{d.rank}]</span>
                    <span className="font-mono text-xs text-success">+{d.exp} EXP</span>
                    <span className="font-mono text-xs text-gold">+{d.gold}G</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </SystemPanel>
        </motion.div>
      </div>
    </div>
  );
}
