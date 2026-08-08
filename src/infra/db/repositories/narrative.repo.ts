import { asc, desc } from "drizzle-orm";
import type { Db } from "../client";
import {
  narrativeFragment,
  type NarrativeFragmentRow,
} from "../schema/narrative";

export class NarrativeRepo {
  constructor(private readonly db: Db) {}

  /** Every unlocked fragment, in story order. */
  async all(): Promise<NarrativeFragmentRow[]> {
    return this.db
      .select()
      .from(narrativeFragment)
      .orderBy(asc(narrativeFragment.ordinal));
  }

  async unlockedIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: narrativeFragment.id })
      .from(narrativeFragment)
      .orderBy(asc(narrativeFragment.ordinal));
    return rows.map((r) => r.id);
  }

  /**
   * The day the arc last advanced. The caller uses this to hold the arc to
   * at most one fragment per calendar day; ordering on unlockedAt rather
   * than ordinal keeps that answer correct even if a row were ever
   * backfilled out of sequence.
   */
  async latestUnlockedDay(): Promise<string | null> {
    const rows = await this.db
      .select({ day: narrativeFragment.unlockedDay })
      .from(narrativeFragment)
      .orderBy(desc(narrativeFragment.unlockedAt))
      .limit(1);
    return rows[0]?.day ?? null;
  }

  /**
   * Only the FIRST call records a fragment. Reading a fragment happens once,
   * and the day it happened is part of the record — a retried cron or a
   * second page load must not restamp it.
   */
  async unlock(
    id: string,
    ordinal: number,
    day: string,
    at: number,
  ): Promise<void> {
    await this.db
      .insert(narrativeFragment)
      .values({ id, ordinal, unlockedDay: day, unlockedAt: at })
      .onConflictDoNothing({ target: narrativeFragment.id });
  }
}
