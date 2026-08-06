/**
 * A skipped lifting day does not vanish — the gate breaks and its volume
 * spills into the next session. The cap is what keeps that a consequence
 * rather than a punishment nobody can clear.
 */
export const DUNGEON_BREAK_PER_MISS = 0.2;
export const DUNGEON_BREAK_CAP = 1.4;

export function dungeonBreakMultiplier(missedSessions: number): number {
  const missed = Math.max(0, Math.floor(missedSessions));
  // Integer tenths: 1 + 2 * 0.2 is 1.4000000000000001 in binary floating
  // point, which would slip past a strict cap comparison.
  const tenths = Math.min(10 + missed * 2, DUNGEON_BREAK_CAP * 10);
  return tenths / 10;
}

export function carriedSets(baseSets: number, missedSessions: number): number {
  return Math.round(baseSets * dungeonBreakMultiplier(missedSessions));
}
