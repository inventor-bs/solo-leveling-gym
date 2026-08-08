import type { RngPort } from "@/ports/rng.port";
import type { SystemContext, SystemMessage, VoiceSeverity } from "./types";

/**
 * [OPENING] + [OBSERVATION] + [DEMAND].
 *
 * Penalty Zone awareness is now wired and takes the highest priority,
 * ahead of even a fresh PR — and the System goes completely silent once
 * `penaltySilent` is set. A weakening shadow is wired too, ranked below
 * the daily quest and streak but above the day's schedule. The rest of
 * the priority order (a falling lift, an active streak's escalation)
 * still depends on systems that don't exist yet. Adding one is adding a
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
  if (context.weakestShadow) {
    return `${context.weakestShadow.name} has weakened. ${context.weakestShadow.daysSinceTrained} days without training.`;
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
  if (context.weakestShadow) {
    return "Do not let a shadow die of neglect.";
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
  // `severity` is not derived yet — that is Task 15's job, once the
  // template branches below know how to grade their own urgency. The cast
  // is scoped to just this field so `body` and `source` stay under normal
  // structural type-checking; the field is genuinely absent at runtime
  // until Task 15 lands.
  if (context.penaltySilent) {
    return {
      body: "",
      source: "template",
      severity: undefined as unknown as VoiceSeverity,
    };
  }
  const parts = [pickOpening(rng), observation(context), demand(context)];
  return {
    body: parts.join(" "),
    source: "template",
    severity: undefined as unknown as VoiceSeverity,
  };
}

export type { SystemContext, SystemMessage };
