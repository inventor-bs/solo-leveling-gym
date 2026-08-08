import type { VoiceRequest } from "@/ports/system-voice.port";
import type { SystemContext, VoiceMessageKind } from "./types";

/** Everything one generation attempt needs, prompt and gate alike. */
export type VoicePlan = {
  readonly request: VoiceRequest;
  /** The only numbers the output is allowed to contain. */
  readonly allowedNumbers: readonly number[];
  /** Strings the output must never contain, whatever else it says. */
  readonly forbiddenText: readonly string[];
};

const VOICE_RULES = [
  "You are The System: a cold evaluation program that speaks to one person.",
  'Address the reader as "Hunter". You do not know their name and must never guess one.',
  "State a fact first, then issue a demand. Do not explain yourself and do not ask permission.",
  "Never offer encouragement, praise, sympathy, or reassurance of any kind.",
  "At most 3 sentences and at most 45 words.",
  "No emoji. At most one exclamation mark in total.",
  "Use ONLY numbers that appear in the FACTS block. Never invent a number, a date, or a weight.",
  "Do not repeat an observation that appears in RECENTLY SAID.",
  'Reply with JSON only: {"body": string, "severity": "info" | "warning" | "critical", "title": string | null}',
].join("\n");

const KIND_INSTRUCTION: Record<VoiceMessageKind, string> = {
  briefing:
    "Write today's opening briefing. Lead with whatever in FACTS is most urgent.",
  quest:
    "Write one line about the Daily Quest specifically: its state today and what remains.",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Every number the context actually contains.
 *
 * This is the whitelist the hallucination gate checks output against, so it
 * has to be built from exactly the same values the FACTS block shows — a
 * number the model was handed but that is missing here would be rejected
 * for being "invented" when it was given.
 *
 * Falls are listed as positive magnitudes because that is how they get
 * spoken: "has fallen 5 kg", never "has fallen -5 kg".
 */
export function contextNumbers(context: SystemContext): number[] {
  const numbers: number[] = [
    context.level,
    context.streakDays,
    round1(context.fatigue),
    context.sessionsLast7d,
    context.missedDays30d,
    context.penaltyCount30d,
    context.unlockedFragments.length,
  ];
  if (context.recentPr) numbers.push(context.recentPr.newE1rmKg);
  if (context.weakestShadow) {
    numbers.push(context.weakestShadow.daysSinceTrained);
  }
  for (const lift of context.liftsUp) numbers.push(Math.abs(lift.deltaKg));
  for (const lift of context.liftsDown) numbers.push(Math.abs(lift.deltaKg));
  return numbers;
}

function factsBlock(context: SystemContext): string {
  const lines: string[] = [
    "[HUNTER]",
    `level: ${context.level}`,
    `rank: ${context.rank}`,
    `title: ${context.title ?? "none"}`,
    `class: ${context.className ?? "none"}`,
    `streak days: ${context.streakDays}`,
    `fatigue: ${round1(context.fatigue)}`,
    `stated reason for training: ${context.reasonForHunting ?? "not given"}`,
    "",
    "[TODAY]",
    `program: ${context.todayProgramName ?? "none"}`,
    `main lift: ${context.todayMainLift ?? "none"}`,
    `rest day: ${context.isRestDay ? "yes" : "no"}`,
    `daily quest complete: ${context.dailyQuestDone ? "yes" : "no"}`,
    "",
    "[RECENT]",
    `sessions in the last 7 days: ${context.sessionsLast7d}`,
    `missed quest days in the last 30: ${context.missedDays30d}`,
    `penalty episodes in the last 30 days: ${context.penaltyCount30d}`,
    `currently in the penalty zone: ${context.penaltyActive ? "yes" : "no"}`,
    "",
    "[TRENDS]",
    `rising: ${
      context.liftsUp.length === 0
        ? "none"
        : context.liftsUp
            .map((l) => `${l.name} +${Math.abs(l.deltaKg)} kg`)
            .join(", ")
    }`,
    `falling: ${
      context.liftsDown.length === 0
        ? "none"
        : context.liftsDown
            .map((l) => `${l.name} -${Math.abs(l.deltaKg)} kg`)
            .join(", ")
    }`,
    `latest record: ${
      context.recentPr
        ? `${context.recentPr.exerciseName} ${context.recentPr.newE1rmKg} kg`
        : "none"
    }`,
    "",
    "[SHADOWS]",
    `army rank: ${context.armyRank ?? "none"}`,
    `weakest: ${
      context.weakestShadow
        ? `${context.weakestShadow.name}, ${context.weakestShadow.daysSinceTrained} days untrained`
        : "none weakening"
    }`,
    "",
    "[NARRATIVE]",
    `arc stage: ${context.arcStage}`,
    `records recovered: ${context.unlockedFragments.length}`,
  ];
  return lines.join("\n");
}

export function buildVoicePlan(
  kind: VoiceMessageKind,
  context: SystemContext,
): VoicePlan {
  const recentlySaid =
    context.lastMessages.length === 0
      ? "nothing yet"
      : context.lastMessages.map((m) => `- ${m}`).join("\n");

  const userPrompt = [
    KIND_INSTRUCTION[kind],
    "",
    "FACTS",
    factsBlock(context),
    "",
    "RECENTLY SAID",
    recentlySaid,
  ].join("\n");

  return {
    request: { kind, systemPrompt: VOICE_RULES, userPrompt },
    allowedNumbers: contextNumbers(context),
    // The hunter's name never enters a prompt, and is refused at the gate
    // too — a model that produced it could only have got it from a source
    // this app does not control.
    forbiddenText: [context.hunterName],
  };
}
