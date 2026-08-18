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

/**
 * Every branch, in the priority order `branchFor` walks. The array is the
 * source of truth and the type is derived from it, so a branch can never be
 * in one and missing from the other.
 */
export const VOICE_BRANCHES = [
  "penalty",
  "shadow",
  "lift-down",
  "quest",
  "streak",
  "pr",
  "program",
  "rest",
  "run",
] as const;

/** Which branch fired. Keeps observation, demand, and severity in lockstep. */
export type VoiceBranch = (typeof VOICE_BRANCHES)[number];

function branchFor(context: SystemContext): VoiceBranch {
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

function observation(context: SystemContext, branch: VoiceBranch): string {
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

function demand(branch: VoiceBranch): string {
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

function severityFor(branch: VoiceBranch): VoiceSeverity {
  if (branch === "penalty") return "critical";
  if (branch === "shadow" || branch === "lift-down" || branch === "quest") {
    return "warning";
  }
  return "info";
}

/**
 * One voice's entire vocabulary: four openings, and one observation and one
 * demand for each branch.
 *
 * A voice is a lookup, not a calculation. Nothing here receives or produces
 * a number that did not come out of the context, and nothing here decides
 * which branch fired or how severe it is.
 */
export type ToneCopy = {
  readonly openings: readonly string[];
  readonly observation: (context: SystemContext, branch: VoiceBranch) => string;
  readonly demand: (branch: VoiceBranch) => string;
};

/**
 * The default voice, wrapped in the shared shape without a single string
 * being retyped: it points straight at the openings and the two functions
 * that have been running in production since this engine was written.
 */
export const COLD_COPY: ToneCopy = { openings: OPENINGS, observation, demand };

/**
 * Contemptuous and challenging: what the Hunter did is treated as the least
 * they could have done. The contempt stays on the effort and never reaches
 * the person, and it never needs an exclamation mark to land — "Predictable,
 * eventually." carries it with punctuation to spare.
 */
export const MOCKING_COPY: ToneCopy = {
  openings: [
    "Still here, Hunter.",
    "Back again, Hunter.",
    "The System was not holding its breath.",
    "Something to report, Hunter?",
  ],
  observation(context, branch) {
    switch (branch) {
      case "penalty":
        return "You are in the Penalty Zone. Nobody put you here.";
      case "shadow": {
        const s = context.weakestShadow!;
        return `${s.name} has weakened. ${s.daysSinceTrained} days, and you noticed nothing.`;
      }
      case "lift-down": {
        const worst = steepestFall(context)!;
        return `${worst.name} has fallen ${Math.abs(worst.deltaKg)} kg. Impressive, in its way.`;
      }
      case "quest":
        return "The Daily Quest is still open. Since morning.";
      case "streak": {
        const unit = context.streakDays === 1 ? "day" : "days";
        return `Daily Quest cleared. Streak: ${context.streakDays} ${unit}. A start.`;
      }
      case "pr": {
        const pr = context.recentPr!;
        return `${pr.exerciseName}: ${pr.newE1rmKg} kg. Predictable, eventually.`;
      }
      case "program":
        return `Today's gate: ${context.todayProgramName}. It has been waiting.`;
      case "rest":
        return "No dungeon today. How convenient.";
      case "run":
        return "Endurance work is scheduled. The part everyone skips.";
    }
  },
  demand(branch) {
    switch (branch) {
      case "penalty":
        return "Clear the Survival Quest, unless you like it here.";
      case "shadow":
        return "Train what made it, before there is nothing left.";
      case "lift-down":
        return "Take it back, or stop calling it your lift.";
      case "quest":
        return "Finish it before the day does.";
      case "streak":
        return "Do not break it now that it counts.";
      case "pr":
        return "Do it again before you start believing it means something.";
      case "program":
        return "Enter it, or find something easier.";
      case "rest":
        return "Recover, since you have nothing else planned.";
      case "run":
        return "Log the distance, since most skip it entirely.";
    }
  },
};

/**
 * Formal and ceremonial: an old power addressing a subject it has already
 * judged. Archaic phrasing is welcome; contractions are not. Gravity is not
 * warmth — this voice gives no praise and no comfort, and the pull toward
 * benediction that old language carries is exactly what it must resist.
 */
export const ANCIENT_COPY: ToneCopy = {
  openings: [
    "Hunter.",
    "Hear the System, Hunter.",
    "The record is opened, Hunter.",
    "Thou art measured, Hunter.",
  ],
  observation(context, branch) {
    switch (branch) {
      case "penalty":
        return "Thou standest within the Penalty Zone. The judgment is already written.";
      case "shadow": {
        const s = context.weakestShadow!;
        return `${s.name} hath weakened. ${s.daysSinceTrained} days hast thou left it untended.`;
      }
      case "lift-down": {
        const worst = steepestFall(context)!;
        return `${worst.name} hath fallen ${Math.abs(worst.deltaKg)} kg from thy peak.`;
      }
      case "quest":
        return "The Daily Quest standeth unfinished.";
      case "streak": {
        const unit = context.streakDays === 1 ? "day" : "days";
        return `Daily Quest cleared. Thy streak standeth at ${context.streakDays} ${unit}.`;
      }
      case "pr": {
        const pr = context.recentPr!;
        return `${pr.exerciseName}: ${pr.newE1rmKg} kg. Thy strength hath grown by a measure none shall dispute.`;
      }
      case "program":
        return `Thy gate this day: ${context.todayProgramName}.`;
      case "rest":
        return "No gate opens for thee this day.";
      case "run":
        return "The long road is set before thee this day.";
    }
  },
  demand(branch) {
    switch (branch) {
      case "penalty":
        return "Clear the Survival Quest. There is no other door.";
      case "shadow":
        return "Return to the work that raised it, ere it fades.";
      case "lift-down":
        return "Reclaim what thou hast let slip.";
      case "quest":
        return "Complete it ere the day is closed.";
      case "streak":
        return "Let it not break upon this day.";
      case "pr":
        return "Rest not upon it — the Gate awaits thy return.";
      case "program":
        return "Enter, and do not tarry.";
      case "rest":
        return "Recover. The next shall not be gentler.";
      case "run":
        return "Record the distance when thou hast run it.";
    }
  },
};

/**
 * Maximum brevity: fragments over sentences, nothing softened, nothing
 * qualified, no warmth and no wit. The shortest line that states the fact
 * and issues the demand is the correct one, which is why every branch here
 * is at or under the length of the Cold line it replaces.
 */
export const MERCILESS_COPY: ToneCopy = {
  openings: [
    "Hunter.",
    "Report, Hunter.",
    "Status, Hunter.",
    "Logged, Hunter.",
  ],
  observation(context, branch) {
    switch (branch) {
      case "penalty":
        return "Penalty Zone. Active.";
      case "shadow": {
        const s = context.weakestShadow!;
        return `${s.name}. Weakened. ${s.daysSinceTrained} days untrained.`;
      }
      case "lift-down": {
        const worst = steepestFall(context)!;
        return `${worst.name}. Down ${Math.abs(worst.deltaKg)} kg.`;
      }
      case "quest":
        return "Daily Quest. Incomplete.";
      case "streak": {
        const unit = context.streakDays === 1 ? "day" : "days";
        return `Daily Quest cleared. Streak ${context.streakDays} ${unit}.`;
      }
      case "pr": {
        const pr = context.recentPr!;
        return `${pr.exerciseName}: ${pr.newE1rmKg} kg. New maximum. Noted.`;
      }
      case "program":
        return `Gate: ${context.todayProgramName}.`;
      case "rest":
        return "No gate today.";
      case "run":
        return "Endurance scheduled.";
    }
  },
  demand(branch) {
    switch (branch) {
      case "penalty":
        return "Clear the Survival Quest.";
      case "shadow":
        return "Train it back.";
      case "lift-down":
        return "Correct it.";
      case "quest":
        return "Finish it today.";
      case "streak":
        return "Hold it.";
      case "pr":
        return "The next one will not come from standing still.";
      case "program":
        return "Enter it.";
      case "rest":
        return "Recover. Nothing else.";
      case "run":
        return "Run it. Log it.";
    }
  },
};

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
