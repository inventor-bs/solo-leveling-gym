import { and, gte, lte, asc } from "drizzle-orm";
import type { Db } from "../client";
import { eventLog, type EventLogRow } from "../schema/event-log";
import type { DomainEvent } from "@/core/shared/events";
import type { TrainingDay } from "@/core/shared/training-day";

export class EventLogRepo {
  constructor(private readonly db: Db) {}

  /** Persists a batch of events, all stamped with the same day and instant. */
  async record(
    events: readonly DomainEvent[],
    day: TrainingDay,
    at: number,
  ): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event, i) => {
      const { type, ...payload } = event;
      return {
        id: `${at}-${i}-${type}`,
        day,
        type,
        payload: JSON.stringify(payload),
        occurredAt: at,
      };
    });
    await this.db.insert(eventLog).values(rows);
  }

  /** Every event in [from, to], inclusive, oldest first. */
  async between(from: TrainingDay, to: TrainingDay): Promise<EventLogRow[]> {
    return this.db
      .select()
      .from(eventLog)
      .where(and(gte(eventLog.day, from), lte(eventLog.day, to)))
      .orderBy(asc(eventLog.occurredAt));
  }
}
