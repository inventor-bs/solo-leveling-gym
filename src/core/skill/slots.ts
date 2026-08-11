/** Starting capacity, before any Rune Stone is bought. */
export const SKILL_SLOTS_BASE = 3;
/** The hard ceiling — the 6th Rune Stone purchase is refused. */
export const SKILL_SLOTS_MAX = 8;

export function slotCapacity(slotsPurchased: number): number {
  const purchased = Math.max(0, Math.floor(slotsPurchased));
  return Math.min(SKILL_SLOTS_BASE + purchased, SKILL_SLOTS_MAX);
}
