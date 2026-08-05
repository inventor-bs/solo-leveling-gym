"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAppStore } from "@/ui/stores/useAppStore";
import clsx from "clsx";
import {
  LayoutDashboard,
  Swords,
  ScrollText,
  Users,
  Package,
  ShoppingBag,
  Zap,
  BookOpen,
  Shield,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", sub: "HUD" },
  { href: "/status", icon: Shield, label: "Status", sub: "Hunter Info" },
  { href: "/quests", icon: ScrollText, label: "Quests", sub: "Daily / Side" },
  { href: "/dungeon", icon: Swords, label: "Dungeon", sub: "Enter Gate" },
  { href: "/shadow-army", icon: Users, label: "Shadow Army", sub: "Soldiers" },
  { href: "/inventory", icon: Package, label: "Inventory", sub: "Items" },
  { href: "/store", icon: ShoppingBag, label: "Store", sub: "Exchange" },
  { href: "/skills", icon: Zap, label: "Skills", sub: "Abilities" },
  { href: "/chronicle", icon: BookOpen, label: "Chronicle", sub: "History" },
];

const RANK_COLORS: Record<string, string> = {
  E: "text-rank-e",
  D: "text-rank-d",
  C: "text-rank-c",
  B: "text-rank-b",
  A: "text-rank-a",
  S: "text-rank-s",
  National: "text-rank-national",
  Monarch: "text-monarch-purple",
};

export function Sidebar() {
  const pathname = usePathname();
  const { hunterName, rank, level, currentExp, maxExp, streakDays } =
    useAppStore();
  const expPct = Math.round((currentExp / maxExp) * 100);

  return (
    <>
      {/* Mobile backdrop (simple) */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-40
        bg-shadow-dark border-r border-system-blue/20
        bg-[linear-gradient(180deg,rgba(0,212,255,0.03)_0%,transparent_50%)]"
      >
        {/* Header */}
        <div className="p-5 border-b border-system-blue/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-system-blue font-mono text-xs tracking-widest uppercase animate-glow-pulse">
              ◈ SYSTEM ONLINE
            </span>
          </div>
          <h1 className="font-cinzel text-white text-lg font-bold tracking-wider">
            SOLO LEVELING
          </h1>
          <p className="text-system-blue/60 font-mono text-xs">
            GYM PROTOCOL v1.0
          </p>
        </div>

        {/* Hunter Card */}
        <div className="p-4 border-b border-system-blue/10">
          <div className="system-panel rounded-lg p-3">
            <div className="system-panel-inner">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-monarch-purple to-shadow-mid
                  border border-system-blue/30 flex items-center justify-center text-lg"
                >
                  🌑
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-cinzel text-white text-sm font-bold truncate">
                    {hunterName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "font-mono text-xs font-bold",
                        RANK_COLORS[rank],
                      )}
                    >
                      [{rank}-RANK]
                    </span>
                    <span className="font-mono text-system-blue/60 text-xs">
                      Lv.{level}
                    </span>
                  </div>
                </div>
              </div>

              {/* EXP bar */}
              <div className="mt-3">
                <div className="flex justify-between font-mono text-xs text-system-blue/50 mb-1">
                  <span>EXP</span>
                  <span>
                    {currentExp.toLocaleString()} / {maxExp.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-shadow-mid rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-system-blue to-monarch-purple rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${expPct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Streak */}
              <div className="mt-2 flex items-center gap-1">
                <span className="text-warning text-xs">🔥</span>
                <span className="font-mono text-xs text-warning">
                  {streakDays} day streak
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map(({ href, icon: Icon, label, sub }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    active
                      ? "bg-system-blue/10 border border-system-blue/30 text-system-blue"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-system-blue/5 border border-system-blue/30"
                    />
                  )}
                  <Icon
                    size={16}
                    className={clsx(
                      "flex-shrink-0 relative z-10",
                      active && "animate-glow-pulse",
                    )}
                  />
                  <div className="flex-1 relative z-10">
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="text-xs text-slate-500 group-hover:text-slate-400 mt-0.5">
                      {sub}
                    </p>
                  </div>
                  {active && (
                    <ChevronRight
                      size={12}
                      className="text-system-blue relative z-10"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-system-blue/10">
          <p className="font-mono text-xs text-system-blue/30 text-center">
            &ldquo;From this point on, I will
            <br />
            be the one who heals himself.&rdquo;
          </p>
        </div>
      </aside>
    </>
  );
}
