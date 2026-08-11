import { randomUUID } from "crypto";
import { and, eq, gte, lte, asc } from "drizzle-orm";
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

  /**
   * Every event in [from, to], inclusive, oldest first. Ordered by `day`
   * before `occurredAt`: daily-reset deliberately stamps yesterday's judged
   * events with today's `occurredAt`, so a late cron run can give an
   * earlier day's event a later `occurredAt` than a day that follows it.
   * Sorting on `occurredAt` alone would put that event out of day order in
   * the timeline; `day` (a lexicographically sortable `YYYY-MM-DD` string)
   * is the primary key here, with `occurredAt` only breaking ties within a
   * single day.
   */
  async between(from: TrainingDay, to: TrainingDay): Promise<EventLogRow[]> {
    return this.db
      .select()
      .from(eventLog)
      .where(and(gte(eventLog.day, from), lte(eventLog.day, to)))
      .orderBy(asc(eventLog.day), asc(eventLog.occurredAt));
  }

  /**
   * How many events of `type` have ever been recorded, with no day bound.
   * Exists for conditions that ask "has this ever happened," where a
   * windowed query would be the wrong tool.
   */
  async countByType(type: string): Promise<number> {
    const rows = await this.db
      .select({ id: eventLog.id })
      .from(eventLog)
      .where(eq(eventLog.type, type));
    return rows.length;
  }
}
