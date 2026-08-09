import { eq, and, gte, lte, asc } from "drizzle-orm";
import type { Db } from "../client";
import {
  hourglassGrace,
  shadowFeed,
  type HourglassGraceRow,
  type ShadowFeedRow,
} from "../schema/mitigation";

export class MitigationRepo {
  constructor(private readonly db: Db) {}

  async graceForDay(day: string): Promise<HourglassGraceRow | null> {
    const rows = await this.db
      .select()
      .from(hourglassGrace)
      .where(eq(hourglassGrace.day, day))
      .limit(1);
    return rows[0] ?? null;
  }

  async grantGrace(day: string, at: number): Promise<void> {
    await this.db
      .insert(hourglassGrace)
      .values({ day, usedAt: at })
      .onConflictDoNothing({ target: hourglassGrace.day });
  }

  /** Grace days inside [from, to], oldest first. Feeds the one-per-week cap. */
  async gracesBetween(from: string, to: string): Promise<HourglassGraceRow[]> {
    return this.db
      .select()
      .from(hourglassGrace)
      .where(and(gte(hourglassGrace.day, from), lte(hourglassGrace.day, to)))
      .orderBy(asc(hourglassGrace.day));
  }

  async feedFor(shadowId: string): Promise<ShadowFeedRow | null> {
    const rows = await this.db
      .select()
      .from(shadowFeed)
      .where(eq(shadowFeed.shadowId, shadowId))
      .limit(1);
    return rows[0] ?? null;
  }

  async allFeeds(): Promise<ShadowFeedRow[]> {
    return this.db.select().from(shadowFeed).orderBy(asc(shadowFeed.shadowId));
  }

  /** Overwrites rather than stacks — one shadow has one reference day. */
  async feed(shadowId: string, extendedUntilDay: string): Promise<void> {
    await this.db
      .insert(shadowFeed)
      .values({ shadowId, extendedUntilDay })
      .onConflictDoUpdate({
        target: shadowFeed.shadowId,
        set: { extendedUntilDay },
      });
  }
}
