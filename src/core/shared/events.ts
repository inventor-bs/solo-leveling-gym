import type { Exp, Gold } from "./units";

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
  | { type: "LevelUp"; from: number; to: number };

export type DomainEventOfType<T extends DomainEvent["type"]> = Extract<
  DomainEvent,
  { type: T }
>;
