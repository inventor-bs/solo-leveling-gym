import { randomUUID } from "crypto";
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
    const rows = events.map((event) => {
      const { type, ...payload } = event;
      return {
        // A deterministic id built from (at, index, type) collides whenever
        // two calls in the same batch context share an instant — exactly
        // what a fixed test clock produces for two sequential writes, and
        // what real back-to-back writes could produce too. A random id has
        // no such collision risk; nothing reads this id back by value.
        id: randomUUID(),
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
