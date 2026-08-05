import type { RngPort } from "@/ports/rng.port";

/**
 * mulberry32 — a 32-bit PRNG, fast, with distribution good enough
 * for loot/quest rolls. Not for cryptographic use.
 */
export function seededRng(seed: number): RngPort {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (minInclusive: number, maxExclusive: number): number => {
      if (maxExclusive <= minInclusive) {
        throw new Error(
          `seededRng.int: max (${maxExclusive}) must be greater than min (${minInclusive})`,
        );
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
  };
}
