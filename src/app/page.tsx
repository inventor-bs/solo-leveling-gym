"use client";
import { motion } from "framer-motion";
import { ShadowParticles } from "@/ui/components/primitives/ShadowParticles";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-void">
      <ShadowParticles />

      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(123,47,190,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-system-blue/3 blur-[120px] pointer-events-none" />

      {/* System boot lines */}
      <motion.div
        className="absolute top-8 left-0 right-0 flex flex-col items-center gap-1 font-mono text-xs text-system-blue/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <span>◈ SYSTEM INITIALIZING...</span>
        <span>◈ HUNTER REGISTRATION PROTOCOL ACTIVE</span>
        <span>◈ GATE DETECTED — RANK UNKNOWN</span>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 text-center px-4 max-w-2xl">
        {/* Rank badge floating */}
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="font-mono text-xs text-system-blue border border-system-blue/30 px-4 py-1 rounded-full tracking-widest animate-glow-pulse">
            ◈ THE SYSTEM HAS CHOSEN YOU ◈
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="font-cinzel text-5xl md:text-7xl font-black text-white mb-4 leading-none tracking-wider"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
        >
          SOLO
          <span className="block holo-text">LEVELING</span>
        </motion.h1>

        <motion.p
          className="font-cinzel text-xl text-system-blue/60 tracking-[0.4em] mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          GYM PROTOCOL
        </motion.p>

        {/* Divider */}
        <motion.div
          className="flex items-center gap-4 my-8 justify-center"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-system-blue/50" />
          <span className="font-mono text-system-blue text-xl">✦</span>
          <div className="h-px flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-system-blue/50" />
        </motion.div>

        {/* System message */}
        <motion.div
          className="system-panel rounded-xl p-6 mb-10 border border-system-blue/30 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
        >
          <div className="system-panel-inner">
            <p className="font-mono text-system-blue text-xs tracking-widest mb-3">[ SYSTEM MESSAGE ]</p>
            <p className="font-mono text-white text-sm leading-relaxed system-flicker">
              &quot;A player has been detected in this world. The System has evaluated your potential
              and found it... acceptable. Your journey from E-Rank begins now.
            </p>
            <p className="font-mono text-white text-sm leading-relaxed mt-2">
              Train. Grow. Arise.&quot;
            </p>
            <div className="mt-4 pt-4 border-t border-system-blue/20">
              <p className="font-mono text-system-blue/50 text-xs">
                ⚠ WARNING: Failure to complete daily quests will result in appropriate punishment.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative px-8 py-4 font-cinzel font-bold text-void bg-system-blue rounded-lg
                text-lg tracking-wider overflow-hidden group shadow-system"
            >
              <motion.span
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.4 }}
              />
              ⚔ ENTER THE GATE
            </motion.button>
          </Link>
          <Link href="/status">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 font-cinzel font-bold text-system-blue border border-system-blue/40
                rounded-lg text-lg tracking-wider hover:bg-system-blue/10 transition-all"
            >
              VIEW STATUS
            </motion.button>
          </Link>
        </motion.div>

        {/* Stats preview */}
        <motion.div
          className="mt-16 grid grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          {[
            { label: "Hunters Awakened", value: "12,847" },
            { label: "Dungeons Cleared", value: "94,231" },
            { label: "Shadows Raised", value: "∞" },
          ].map(({ label, value }) => (
            <div key={label} className="system-panel rounded-lg p-3 border border-system-blue/20">
              <div className="system-panel-inner text-center">
                <p className="font-mono text-xl font-bold text-system-blue">{value}</p>
                <p className="font-mono text-xs text-slate-500 mt-1">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom scan line */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <motion.p
          className="font-mono text-xs text-system-blue/30 tracking-widest"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ◈ SCROLL TO PROCEED ◈
        </motion.p>
      </div>
    </div>
  );
}
