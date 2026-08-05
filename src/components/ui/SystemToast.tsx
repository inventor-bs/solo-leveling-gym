"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import clsx from "clsx";

const TYPE_CONFIG = {
  info:    { border: "border-system-blue/50",   bg: "bg-system-blue/10",   icon: "◈", text: "text-system-blue" },
  warning: { border: "border-warning/50",        bg: "bg-warning/10",       icon: "⚠", text: "text-warning" },
  danger:  { border: "border-danger/50",         bg: "bg-danger/10",        icon: "⚡", text: "text-danger" },
  success: { border: "border-success/50",        bg: "bg-success/10",       icon: "✦", text: "text-success" },
};

export function SystemToastProvider() {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => {
          const cfg = TYPE_CONFIG[n.type];
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              className={clsx(
                "pointer-events-auto system-panel rounded-lg px-4 py-3 border max-w-xs",
                cfg.border, cfg.bg
              )}
              onClick={() => removeNotification(n.id)}
            >
              <div className="system-panel-inner flex items-start gap-2">
                <span className={clsx("font-mono text-sm animate-glow-pulse", cfg.text)}>{cfg.icon}</span>
                <div>
                  <p className="font-mono text-xs text-slate-300 leading-relaxed">{n.message}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function useSystemToast() {
  const addNotification = useAppStore((s) => s.addNotification);
  return {
    info: (msg: string) => addNotification(msg, "info"),
    warn: (msg: string) => addNotification(msg, "warning"),
    danger: (msg: string) => addNotification(msg, "danger"),
    success: (msg: string) => addNotification(msg, "success"),
  };
}
