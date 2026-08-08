import type { ArcStage } from "@/core/narrative/fragments";

/** Drives how loudly the message is presented. */
export type VoiceSeverity = "info" | "warning" | "critical";

/**
 * Where a message came from. Named after the PROVIDER, not "generated vs
 * fallback": swapping in a second adapter should be distinguishable here
 * without a migration.
 */
export type VoiceSource = "template" | "gemini";

/** A slot in the day's pre-generated pool. */
export type VoiceMessageKind = "briefing" | "quest";

/**
 * Every kind generated at the reset — deliberately only the kinds something
 * in this app renders. Generating a message nothing reads spends quota and
 * hides a dead branch behind plausible-looking infrastructure.
 */
export const VOICE_POOL_KINDS: readonly VoiceMessageKind[] = [
  "briefing",
  "quest",
] as const;

/** One lift's movement across the trend windows. `deltaKg` is signed. */
export type LiftDelta = {
  readonly name: string;
  readonly deltaKg: number;
};

/**
 * The single object the template engine and the LLM prompt builder both
 * consume. Flat rather than nested: the template engine has read these
 * fields directly since the day it was written, and regrouping them would
 * be pure churn. The grouping that matters is preserved in the FACTS block
 * the prompt builder serializes.
 *
 * Every value here is measured, derived, or authored — nothing in it can be
 * bought, and nothing that reads it may invent a number it does not carry.
 */
export type SystemContext = {
  // hunter
  readonly hunterName: string;
  readonly level: number;
  readonly rank: string;
  readonly title: string | null;
  readonly className: string | null;
  readonly streakDays: number;
  readonly fatigue: number;
  readonly reasonForHunting: string | null;

  // today
  readonly todayProgramName: string | null;
  readonly todayMainLift: string | null;
  readonly isRestDay: boolean;
  readonly dailyQuestDone: boolean;

  // recent
  readonly sessionsLast7d: number;
  readonly missedDays30d: number;
  readonly penaltyCount30d: number;

  // trends
  readonly liftsUp: readonly LiftDelta[];
  readonly liftsDown: readonly LiftDelta[];
  readonly recentPr: { exerciseName: string; newE1rmKg: number } | null;

  // penalty
  readonly penaltyActive: boolean;
  readonly penaltySilent: boolean;

  // shadows
  readonly weakestShadow: { name: string; daysSinceTrained: number } | null;
  readonly armyRank: string | null;

  // narrative
  readonly arcStage: ArcStage;
  readonly unlockedFragments: readonly string[];

  /**
   * The last few bodies shown, newest first. Without this the voice repeats
   * one observation for three days running and stops sounding alive.
   */
  readonly lastMessages: readonly string[];
};

export type SystemMessage = {
  readonly body: string;
  readonly severity: VoiceSeverity;
  readonly source: VoiceSource;
};
