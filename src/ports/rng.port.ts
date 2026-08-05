/**
 * Hidden quests, loot drops, and Emergency Quests are all probabilistic.
 * A seeded RNG lets distributions be tested deterministically.
 */
export interface RngPort {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
}
