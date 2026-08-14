/**
 * Pure presentation. No number anywhere in the app reads any of this — a
 * skin changes a border, a gradient and a glow, and nothing else.
 */
export const SKIN_STYLE: Record<string, string> = {
  ember:
    "border-orange-500/50 bg-gradient-to-b from-orange-500/15 to-shadow-dark animate-glow-pulse shadow-[0_0_14px_rgba(249,115,22,0.35)]",
  frost:
    "border-cyan-300/50 bg-gradient-to-b from-cyan-400/15 to-shadow-dark animate-glow-pulse shadow-[0_0_14px_rgba(103,232,249,0.4)]",
  void: "border-monarch-purple/60 bg-gradient-to-b from-monarch-purple/20 to-void animate-float shadow-[0_0_16px_rgba(123,47,190,0.45)]",
};
