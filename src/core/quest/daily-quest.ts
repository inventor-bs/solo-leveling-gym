import type { Rank } from "@/core/hunter/progression";

export type QuestTargets = {
  readonly pushups: number;
  readonly situps: number;
  readonly squats: number;
  readonly runKm: number;
};

export type QuestProgress = QuestTargets;

/**
 * The classic 100/100/100 + 10 km is the destination, not the entry fee.
 * Handing that to someone who has never logged a session guarantees a
 * failed first day. The ladder starts where an untrained hunter can
 * actually finish.
 *
 * The scale is defined up to S. National and Monarch reuse the S load
 * rather than extrapolating a number nobody has balanced.
 */
const SCALE: Record<Rank, QuestTargets> = {
  E: { pushups: 20, situps: 20, squats: 20, runKm: 1 },
  D: { pushups: 30, situps: 30, squats: 30, runKm: 2 },
  C: { pushups: 45, situps: 45, squats: 45, runKm: 3 },
  B: { pushups: 60, situps: 60, squats: 60, runKm: 5 },
  A: { pushups: 80, situps: 80, squats: 80, runKm: 7 },
  S: { pushups: 100, situps: 100, squats: 100, runKm: 10 },
  National: { pushups: 100, situps: 100, squats: 100, runKm: 10 },
  Monarch: { pushups: 100, situps: 100, squats: 100, runKm: 10 },
};

export function dailyQuestTargets(rank: Rank): QuestTargets {
  return SCALE[rank];
}

export function isQuestComplete(
  targets: QuestTargets,
  progress: QuestProgress,
): boolean {
  return (
    progress.pushups >= targets.pushups &&
    progress.situps >= targets.situps &&
    progress.squats >= targets.squats &&
    progress.runKm >= targets.runKm
  );
}

function ratio(done: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(done / target, 1);
}

/** Equal weight per requirement; a single overshot lift cannot mask three skipped ones. */
export function questCompletionPercent(
  targets: QuestTargets,
  progress: QuestProgress,
): number {
  const parts = [
    ratio(progress.pushups, targets.pushups),
    ratio(progress.situps, targets.situps),
    ratio(progress.squats, targets.squats),
    ratio(progress.runKm, targets.runKm),
  ];
  const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.round(mean * 100);
}
