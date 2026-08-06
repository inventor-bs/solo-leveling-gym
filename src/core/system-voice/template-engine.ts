import type { RngPort } from "@/ports/rng.port";
import type { SystemContext, SystemMessage } from "./types";

/**
 * [OPENING] + [OBSERVATION] + [DEMAND].
 *
 * Penalty Zone awareness is now wired and takes the highest priority,
 * ahead of even a fresh PR — and the System goes completely silent once
 * `penaltySilent` is set. The rest of the priority order (a weakening
 * shadow, a falling lift, an active streak's escalation) still depends
 * on systems that don't exist until Phase 3. Adding one is adding a
 * function to this list — the composition and the voice rules below
 * don't change.
 */

const OPENINGS = [
  "Hunter.",
  "System notice.",
  "Attention, Hunter.",
  "The System is watching.",
] as const;

function observation(context: SystemContext): string {
  if (context.penaltyActive) {
    return "You are in the Penalty Zone.";
  }
  if (context.recentPr) {
    return `${context.recentPr.exerciseName}: ${context.recentPr.newE1rmKg} kg. A new record.`;
  }
  if (!context.dailyQuestDone) {
    return "The Daily Quest is not complete.";
  }
  if (context.streakDays > 0) {
    const unit = context.streakDays === 1 ? "day" : "days";
    return `Daily Quest cleared. Streak: ${context.streakDays} ${unit}.`;
  }
  if (context.todayProgramName) {
    return `Today's gate: ${context.todayProgramName}.`;
  }
  if (context.isRestDay) {
    return "No dungeon is scheduled today.";
  }
  return "Endurance training is scheduled today.";
}

function demand(context: SystemContext): string {
  if (context.penaltyActive) {
    return "Clear the Survival Quest to leave it.";
  }
  if (context.recentPr) {
    return "Do not let this be the last time.";
  }
  if (!context.dailyQuestDone) {
    return "Finish it before the day ends.";
  }
  if (context.todayProgramName) {
    return "Enter the dungeon.";
  }
  if (context.isRestDay) {
    return "Rest is not weakness. Recover.";
  }
  return "Log the distance when it is done.";
}

/** Picks an opening deterministically from the given RNG. */
function pickOpening(rng: RngPort): string {
  const index = rng.int(0, OPENINGS.length);
  return OPENINGS[index] ?? OPENINGS[0];
}

export function buildSystemMessage(
  context: SystemContext,
  rng: RngPort,
): SystemMessage {
  if (context.penaltySilent) {
    return { body: "", source: "template" };
  }
  const parts = [pickOpening(rng), observation(context), demand(context)];
  return { body: parts.join(" "), source: "template" };
}

export type { SystemContext, SystemMessage };
