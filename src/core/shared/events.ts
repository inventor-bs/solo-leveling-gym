import type { Exp, Gold, Kg } from "./units";
import type { EquipmentGrade, EquipmentSlot } from "@/core/economy/pricing";

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
  | { type: "ShadowArisen"; shadowId: string; shadowName: string }
  | { type: "TitleEarned"; titleId: string; titleName: string }
  | { type: "NarrativeFragmentUnlocked"; fragmentId: string; ordinal: number }
  | {
      type: "HiddenQuestRevealed";
      questId: string;
      questName: string;
      goldAwarded: Gold;
    }
  | { type: "GoldSpent"; amount: Gold; source: string }
  | {
      type: "EquipmentDropped";
      slot: EquipmentSlot;
      name: string;
      grade: EquipmentGrade;
      /** The grade this drop displaced, or null when the slot was empty. */
      replacedGrade: EquipmentGrade | null;
    }
  | { type: "RedGateCleared"; day: string }
  | { type: "RedGateFailed"; day: string }
  | { type: "BossRaidCleared"; day: string; prCount: number }
  | { type: "DemonCastleFloorCleared"; floor: number }
  /**
   * The three weekly events carry `weekStart` — the Monday of the week they
   * describe — rather than the day they were computed on, and are persisted
   * stamped with that day. That is what makes a repeated cron run idempotent:
   * the reset looks for an existing row on `weekStart` before paying again.
   */
  | { type: "PerfectWeek"; weekStart: string; goldAwarded: Gold }
  | {
      type: "WagerWon";
      weekStart: string;
      stakeGold: Gold;
      payoutGold: Gold;
    }
  | { type: "WagerLost"; weekStart: string; stakeGold: Gold }
  | { type: "FatigueDecayed"; day: string };

export type DomainEventOfType<T extends DomainEvent["type"]> = Extract<
  DomainEvent,
  { type: T }
>;
