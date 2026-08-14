import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Five discrete steps and no sixth. Tier 0 is no aura at all and renders
 * the children untouched.
 *
 * There is intentionally no entry past 5: buying beyond the cap still costs
 * escalating gold and still increments the stored level, and changes
 * nothing here. The economy needs one sink that never runs out; the screen
 * does not.
 */
// Tiers 4 and 5 use `shadow-[...]` (box-shadow), not `drop-shadow-[...]`
// (filter): `animate-glow-pulse` (see tailwind.config.ts) animates `filter`
// for its full `infinite` duration, so a static `drop-shadow-[...]` utility
// on the same element would never win against it and both tiers would show
// only glow-pulse's own System-blue filter keyframes. `shadow-*` (box-shadow)
// is a different CSS property, so it renders alongside the animation intact
// — the same pairing every other `animate-glow-pulse` usage in this codebase
// already uses (see RankBadge).
const TIER_GLOW: Record<number, string> = {
  1: "drop-shadow-[0_0_4px_rgba(123,47,190,0.35)]",
  2: "drop-shadow-[0_0_8px_rgba(123,47,190,0.45)]",
  3: "drop-shadow-[0_0_12px_rgba(123,47,190,0.55)]",
  4: "shadow-[0_0_18px_rgba(123,47,190,0.65)] animate-glow-pulse",
  5: "shadow-[0_0_26px_rgba(255,215,0,0.7)] animate-glow-pulse",
};

export function AuraGlow({
  tier,
  children,
}: {
  tier: number;
  children: ReactNode;
}) {
  const glow = TIER_GLOW[tier];
  if (!glow) return <>{children}</>;
  return <span className={clsx("inline-block", glow)}>{children}</span>;
}
