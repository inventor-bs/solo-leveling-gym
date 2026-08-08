import { rankForLevel } from "@/core/hunter/progression";

/** The shape a persisted event row is reduced to before classification — deliberately loose (payload is `unknown`) since this module only reads the handful of fields each entry kind actually needs. */
export type RawEvent = {
  readonly type: string;
  readonly day: string;
  readonly occurredAt: number;
  readonly payload: unknown;
};

export type TimelineEntry = {
  readonly kind: "arise" | "rank-up" | "pr" | "penalty-zone";
  readonly day: string;
  readonly occurredAt: number;
  readonly summary: string;
};

function asRecord(payload: unknown): Record<string, unknown> {
  return payload as Record<string, unknown>;
}

/**
 * The timeline is curated, not a raw event dump — only these four kinds
 * ever get shown, matching exactly what the spec's own timeline example
 * lists. Everything else (SetLogged, GoldGained, QuestProgressLogged, ...)
 * is real history but not timeline-worthy on its own.
 */
export function toTimelineEntries(
  events: readonly RawEvent[],
  exerciseNames: ReadonlyMap<string, string> = new Map(),
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const event of events) {
    if (event.type === "ShadowArisen") {
      const p = asRecord(event.payload);
      entries.push({
        kind: "arise",
        day: event.day,
        occurredAt: event.occurredAt,
        summary: `${p.shadowName as string} has answered your call`,
      });
    } else if (event.type === "PrAchieved") {
      const p = asRecord(event.payload);
      const exerciseId = p.exerciseId as string;
      const name = exerciseNames.get(exerciseId) ?? exerciseId;
      entries.push({
        kind: "pr",
        day: event.day,
        occurredAt: event.occurredAt,
        summary: `${name} ${p.newE1rm as number} kg`,
      });
    } else if (event.type === "PenaltyStarted") {
      entries.push({
        kind: "penalty-zone",
        day: event.day,
        occurredAt: event.occurredAt,
        summary: "Daily Quest failed",
      });
    } else if (event.type === "LevelUp") {
      const p = asRecord(event.payload);
      const fromRank = rankForLevel(p.from as number);
      const toRank = rankForLevel(p.to as number);
      if (fromRank !== toRank) {
        entries.push({
          kind: "rank-up",
          day: event.day,
          occurredAt: event.occurredAt,
          summary: `${fromRank} → ${toRank}`,
        });
      }
    }
    // Every other type is real history the event log keeps, but not one of
    // the four kinds the Chronicle timeline shows.
  }

  return entries;
}
