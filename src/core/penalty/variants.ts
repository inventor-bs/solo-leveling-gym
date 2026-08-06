/**
 * Fear-based motivation collapses once the fear stops being novel. By the
 * fourth centipede desert the punishment is just a chore, so the setting
 * and the System's patience change each time. Same mechanics, different
 * experience — the cost is copy, not code.
 */
export type PenaltyVariant = {
  readonly id: 1 | 2 | 3 | 4;
  readonly setting: string;
  readonly tone: string;
  readonly openingLine: string;
};

export const PENALTY_VARIANTS: readonly PenaltyVariant[] = [
  {
    id: 1,
    setting: "Desert of Giant Centipedes",
    tone: "cold",
    openingLine:
      "You failed to complete the Daily Quest. The penalty has begun.",
  },
  {
    id: 2,
    setting: "Cavern of Ice",
    tone: "impatient",
    openingLine: "Again, Hunter. The System does not enjoy repeating itself.",
  },
  {
    id: 3,
    setting: "Dark Swamp",
    tone: "contemptuous",
    openingLine: "A third failure, Hunter. Strength was always available.",
  },
  {
    id: 4,
    setting: "The Cycle Repeats",
    tone: "indifferent",
    openingLine: "You are here again. The System has stopped being surprised.",
  },
] as const;

export function penaltyVariantFor(priorPenaltyCount: number): PenaltyVariant {
  const prior = Math.max(0, Math.floor(priorPenaltyCount));
  const variant = PENALTY_VARIANTS[prior % PENALTY_VARIANTS.length];
  // PENALTY_VARIANTS is a non-empty literal, so this fallback is unreachable;
  // it exists because a modulo index is not provably in-bounds to the compiler.
  return variant ?? PENALTY_VARIANTS[0]!;
}
