import type { RngPort } from "@/ports/rng.port";

/**
 * mulberry32 — PRNG 32-bit, nhanh, phân phối đủ tốt cho loot/quest.
 * Không dùng cho mục đích mật mã.
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
          `seededRng.int: max (${maxExclusive}) phải lớn hơn min (${minInclusive})`,
        );
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
  };
}
