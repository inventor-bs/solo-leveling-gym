import type { RngPort } from "@/ports/rng.port";
import type { SystemContext, SystemMessage, VoiceSeverity } from "./types";

/**
 * [OPENING] + [OBSERVATION] + [DEMAND].
 *
 * This is the base layer, not a fallback. It always says something true
 * about what is actually happening, it needs no network, and it is what
 * runs during a test, an outage, or a day with no API key configured.
 *
 * The branch order below is the priority order, and it is deliberate: the
 * things that are decaying come before the things that are going well. An
 * engine that congratulates a record while a shadow rots is doing the one
 * thing the voice rules forbid. Adding a new observation is adding a branch
 * at the right height in this list — nothing else changes.
 */

const OPENINGS = [
  "Hunter.",
  "System notice.",
  "Attention, Hunter.",
  "The System is watching.",
] as const;

/** Which branch fired. Keeps observation, demand, and severity in lockstep. */
type Branch =
  | "penalty"
  | "shadow"
  | "lift-down"
  | "quest"
  | "streak"
  | "pr"
  | "program"
  | "rest"
  | "run";

function branchFor(context: SystemContext): Branch {
  if (context.penaltyActive) return "penalty";
  if (context.weakestShadow) return "shadow";
  if (context.liftsDown.length > 0) return "lift-down";
  if (!context.dailyQuestDone) return "quest";
  if (context.streakDays > 0) return "streak";
  if (context.recentPr) return "pr";
  if (context.todayProgramName) return "program";
  if (context.isRestDay) return "rest";
  return "run";
}

/** The steepest fall, so the message names the lift that matters most. */
function steepestFall(
  context: SystemContext,
): { name: string; deltaKg: number } | null {
  let worst: { name: string; deltaKg: number } | null = null;
  for (const lift of context.liftsDown) {
    if (worst === null || lift.deltaKg < worst.deltaKg) worst = lift;
  }
  return worst;
}

function observation(context: SystemContext, branch: Branch): string {
  switch (branch) {
    case "penalty":
      return "You are in the Penalty Zone.";
    case "shadow": {
      const s = context.weakestShadow!;
      return `${s.name} has weakened. ${s.daysSinceTrained} days without training.`;
    }
    case "lift-down": {
      const worst = steepestFall(context)!;
      return `${worst.name} has fallen ${Math.abs(worst.deltaKg)} kg from your peak.`;
    }
    case "quest":
      return "The Daily Quest is not complete.";
    case "streak": {
      const unit = context.streakDays === 1 ? "day" : "days";
      return `Daily Quest cleared. Streak: ${context.streakDays} ${unit}.`;
    }
    case "pr": {
      const pr = context.recentPr!;
      return `${pr.exerciseName}: ${pr.newE1rmKg} kg. A new record.`;
    }
    case "program":
      return `Today's gate: ${context.todayProgramName}.`;
    case "rest":
      return "No dungeon is scheduled today.";
    case "run":
      return "Endurance training is scheduled today.";
  }
}

function demand(branch: Branch): string {
  switch (branch) {
    case "penalty":
      return "Clear the Survival Quest to leave it.";
    case "shadow":
      return "Do not let a shadow die of neglect.";
    case "lift-down":
      return "Take it back.";
    case "quest":
      return "Finish it before the day ends.";
    case "streak":
      return "Do not break it today.";
    case "pr":
      return "Do not let this be the last time.";
    case "program":
      return "Enter the dungeon.";
    case "rest":
      return "Rest is not weakness. Recover.";
    case "run":
      return "Log the distance when it is done.";
  }
}

function severityFor(branch: Branch): VoiceSeverity {
  if (branch === "penalty") return "critical";
  if (branch === "shadow" || branch === "lift-down" || branch === "quest") {
    return "warning";
  }
  return "info";
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
  const branch = branchFor(context);
  const severity = severityFor(branch);

  // Silence is a state, not an absent message: the caller still needs to
  // know how bad things are in order to render the empty panel correctly.
  if (context.penaltySilent) {
    return { body: "", severity, source: "template" };
  }

  const parts = [
    pickOpening(rng),
    observation(context, branch),
    demand(branch),
  ];
  return { body: parts.join(" "), severity, source: "template" };
}

export type { SystemContext, SystemMessage };
