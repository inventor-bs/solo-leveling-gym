import type { Exp, Gold, Kg } from "./units";

/**
 * A domain event is a return value from core, NOT an infrastructure concept.
 * app-services collects these, persists them in a single transaction,
 * then forwards them to the UI to drive animations.
 *
 * Later phases will add more variants to this union.
 */
export type DomainEvent =
  | { type: "ExpGained"; amount: Exp; source: string }
  | { type: "GoldGained"; amount: Gold; source: string }
  | { type: "LevelUp"; from: number; to: number }
  | { type: "SetLogged"; exerciseId: string; setIndex: number }
  | { type: "PrAchieved"; exerciseId: string; newE1rm: Kg; previousE1rm: Kg }
  | {
      type: "SessionCompleted";
      sessionId: string;
      rank: "E" | "D" | "C" | "B" | "A";
      goldAwarded: Gold;
      expAwarded: Exp;
    }
  | { type: "RunLogged"; distanceKm: number; durationSec: number }
  | { type: "QuestProgressLogged"; day: string }
  | { type: "DailyQuestCompleted"; day: string; streak: number }
  | { type: "DailyQuestMissed"; day: string }
  | { type: "PenaltyStarted"; day: string; variantId: number; expLost: number }
  | { type: "PenaltyCleared"; day: string; daysStuck: number }
  | { type: "ReawakeningOffered"; dormantDays: number }
  | { type: "DungeonBreak"; missedSessions: number; multiplier: number }
  | { type: "ShadowArisen"; shadowId: string; shadowName: string };

export type DomainEventOfType<T extends DomainEvent["type"]> = Extract<
  DomainEvent,
  { type: T }
>;
