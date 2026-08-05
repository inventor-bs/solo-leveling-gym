/**
 * Hidden quest, loot drop, Emergency Quest đều có xác suất.
 * Seeded RNG cho phép test phân phối một cách tất định.
 */
export interface RngPort {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
}
