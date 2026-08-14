import {
  AURA_BASE_COST,
  AURA_COST_GROWTH,
  AURA_VISUAL_MAX_LEVEL,
} from "@/core/economy/pricing";

/**
 * What the NEXT aura purchase costs, given how many have already been made.
 *
 * Rounded so the formula has exactly one answer: the Store quotes a price
 * and the purchase charges a price, and those two must be the same integer.
 * There is no cap here on purpose — this is the economy's one sink that
 * never runs out, and the price is what keeps it meaningful once the finite
 * catalog is exhausted.
 */
export function auraCost(level: number): number {
  return Math.round(AURA_BASE_COST * AURA_COST_GROWTH ** level);
}

/**
 * Which of the five discrete glow steps to render. Zero means no glow.
 *
 * Saturating here rather than refusing the purchase is the deliberate
 * shape: the gold budget is unbounded, the visual budget is not, and the
 * Store says so in words before a saturated purchase is made.
 */
export function auraVisualTier(level: number): number {
  if (level <= 0) return 0;
  return Math.min(level, AURA_VISUAL_MAX_LEVEL);
}
