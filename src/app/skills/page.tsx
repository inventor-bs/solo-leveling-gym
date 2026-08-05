"use client";
import { motion } from "framer-motion";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import clsx from "clsx";

const SKILLS = [
  // Active
  { id: "shadow-ex",  name: "Shadow Extraction",    type: "active",  level: 10, maxLevel: 10, desc: "Extract and command fallen shadows.", locked: false, icon: "🌑" },
  { id: "deadlift",   name: "Deadlift Mastery",      type: "active",  level: 5,  maxLevel: 10, desc: "Perfect conventional deadlift form. STR +5%.", locked: false, icon: "🏋️" },
  { id: "bench",      name: "Bench Press Protocol",  type: "active",  level: 4,  maxLevel: 10, desc: "Optimal chest activation. STR +4%.", locked: false, icon: "💪" },
  { id: "hiit",       name: "HIIT Protocol",         type: "active",  level: 3,  maxLevel: 10, desc: "High intensity interval training. AGI +8%.", locked: false, icon: "⚡" },
  { id: "ruler",      name: "Ruler's Authority",     type: "active",  level: 1,  maxLevel: 5,  desc: "Command all muscles simultaneously. All stats +2%.", locked: false, icon: "👑" },
  { id: "arise",      name: "Arise",                 type: "active",  level: 0,  maxLevel: 1,  desc: "???", locked: true, icon: "❓" },
  // Passive
  { id: "sleep",      name: "Sleep Optimization",    type: "passive", level: 2,  maxLevel: 5,  desc: "Recovery rate +20% when sleeping 7+ hours.", locked: false, icon: "🌙" },
  { id: "nutrition",  name: "Meal Prep Mastery",     type: "passive", level: 1,  maxLevel: 5,  desc: "Nutrient absorption +15%. Buff items +10% effect.", locked: false, icon: "🥗" },
  { id: "str-enh",    name: "Strength Enhancement",  type: "passive", level: 3,  maxLevel: 10, desc: "Permanent STR +3 per level.", locked: false, icon: "🔩" },
  { id: "shadow-sen", name: "Shadow Sense",          type: "passive", level: 2,  maxLevel: 5,  desc: "Detect muscle imbalances automatically.", locked: false, icon: "👁️" },
  { id: "iron-will",  name: "Iron Will",             type: "passive", level: 2,  maxLevel: 5,  desc: "Willpower stat. Reduces streak break chance.", locked: false, icon: "🧠" },
  { id: "stealth",    name: "Stealth Training",      type: "passive", level: 0,  maxLevel: 3,  desc: "???", locked: true, icon: "❓" },
];

export default function SkillsPage() {
  const active = SKILLS.filter((s) => s.type === "active");
  const passive = SKILLS.filter((s) => s.type === "passive");

  return (
    <div className="relative min-h-screen bg-void p-6 md:p-8">
      <ShadowParticles />
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">◈ SYSTEM — SKILL WINDOW</p>
          <h1 className="font-cinzel text-3xl font-black text-white">SKILL WINDOW</h1>
        </motion.div>

        {[{ label: "ACTIVE SKILLS", items: active }, { label: "PASSIVE SKILLS", items: passive }].map(({ label, items }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SystemPanel header={label}>
              <div className="p-3 space-y-2">
                {items.map((skill, i) => (
                  <motion.div
                    key={skill.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={clsx(
                      "flex items-center gap-4 p-3 rounded-lg border transition-all",
                      skill.locked
                        ? "border-slate-800 bg-shadow-dark opacity-50 cursor-not-allowed"
                        : "border-system-blue/15 bg-shadow-mid/40 hover:border-system-blue/35 cursor-pointer"
                    )}
                  >
                    <span className="text-2xl flex-shrink-0">{skill.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={clsx("font-cinzel text-sm font-bold", skill.locked ? "text-slate-600" : "text-white")}>
                          {skill.locked ? "???" : skill.name}
                        </h3>
                        {!skill.locked && skill.level === skill.maxLevel && (
                          <span className="font-mono text-xs text-gold">MAX</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-slate-500 mt-0.5">
                        {skill.locked ? "Unlock conditions unknown." : skill.desc}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {!skill.locked && (
                        <>
                          <p className="font-mono text-sm font-bold text-system-blue">
                            Lv.{skill.level}<span className="text-slate-600">/{skill.maxLevel}</span>
                          </p>
                          <div className="w-16 h-1 bg-shadow-dark rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-system-blue/70 rounded-full"
                              style={{ width: `${(skill.level / skill.maxLevel) * 100}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </SystemPanel>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
