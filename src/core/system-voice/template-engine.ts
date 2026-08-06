import type { RngPort } from "@/ports/rng.port";
import type { SystemContext, SystemMessage } from "./types";

/**
 * [OPENING] + [OBSERVATION] + [DEMAND].
 *
 * Only two observation branches are wired: a recent PR, and the default.
 * The rest of the priority order (Penalty Zone, a weakening shadow, a
 * falling lift, an active streak) depends on systems that don't exist
 * until Phase 2/3. Adding one is adding a function to this list — the
 * composition and the voice rules below don't change.
 */

const OPENINGS = [
  "Hunter.",
  "System notice.",
  "Attention, Hunter.",
  "The System is watching.",
] as const;

function observation(context: SystemContext): string {
  if (context.recentPr) {
    return `${context.recentPr.exerciseName}: ${context.recentPr.newE1rmKg} kg. A new record.`;
  }
  if (context.todayProgramName) {
    return `Today's gate: ${context.todayProgramName}.`;
  }
  return "No dungeon is scheduled today.";
}

function demand(context: SystemContext): string {
  if (context.recentPr) {
    return "Do not let this be the last time.";
  }
  if (context.todayProgramName) {
    return "Enter the dungeon.";
  }
  return "Rest is not weakness. Recover.";
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
  const parts = [pickOpening(rng), observation(context), demand(context)];
  return { body: parts.join(" "), source: "template" };
}

export type { SystemContext, SystemMessage };
