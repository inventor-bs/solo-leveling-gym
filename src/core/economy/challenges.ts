import {
  BOSS_RAID_PR_GOLD,
  DEMON_CASTLE_RATIO_PER_FLOOR,
  PR_GOLD,
  RED_GATE_REWARD_MULTIPLIER,
  RED_GATE_VOLUME_RATIO,
} from "./pricing";

/** The three things a hunter can buy that make the next session harder. */
export const CHALLENGE_TYPES = [
  "red-gate",
  "boss-raid",
  "demon-castle",
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** Runtime guard for pending_challenge.type, a plain TEXT column. */
export function isChallengeType(value: string): value is ChallengeType {
  return (CHALLENGE_TYPES as readonly string[]).includes(value);
}

/** The volume load a session must reach to clear a Red Gate. */
export function redGateTargetVolume(avgVolume: number): number {
  return avgVolume * RED_GATE_VOLUME_RATIO;
}

/** Floor N's target: the average plus 10% of it per floor. */
export function demonCastleTargetVolume(
  avgVolume: number,
  floor: number,
): number {
  return avgVolume * (1 + DEMON_CASTLE_RATIO_PER_FLOOR * floor);
}

/**
 * Whether a session hit a volume target.
 *
 * `avgVolume` is taken as a separate argument rather than inferred, because
 * a hunter with no completed sessions has an average of zero — and any
 * multiple of zero is zero, which every session trivially reaches. A target
 * that cannot be measured has not been cleared, so this refuses rather than
 * handing out a quadrupled reward for a single set on a fresh database.
 */
export function volumeTargetMet(
  plannedVolume: number,
  targetVolume: number,
  avgVolume: number,
): boolean {
  if (avgVolume <= 0) return false;
  return plannedVolume >= targetVolume;
}

/** Applied to both gold and EXP. Neutral when the gate was not cleared. */
export function redGateRewardMultiplier(cleared: boolean): number {
  return cleared ? RED_GATE_REWARD_MULTIPLIER : 1;
}

/** The per-PR rate handed to goldForPrs for this session. */
export function bossRaidGoldPerPr(cleared: boolean): number {
  return cleared ? BOSS_RAID_PR_GOLD : PR_GOLD;
}
