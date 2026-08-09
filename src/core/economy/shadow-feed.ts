/**
 * Lowers the inactivity count a shadow is judged on, by however many days
 * of feeding it still has in hand.
 *
 * This is the whole of the Shadow Feed mechanic, and it is an ADJUSTMENT by
 * construction: it never sees the shadow's stored EXP, so there is no way
 * for it to write one. Weakening still reads the raw stored value; it is
 * only handed a smaller number of days to decay over.
 *
 * A negative `feedDaysRemaining` means the feed has already expired, and is
 * clamped rather than allowed to age the shadow faster than reality.
 */
export function effectiveDaysInactive(
  daysInactive: number,
  feedDaysRemaining: number,
): number {
  const credited = Math.max(0, Math.floor(feedDaysRemaining));
  return Math.max(0, daysInactive - credited);
}
