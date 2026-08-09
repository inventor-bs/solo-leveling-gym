import { eq, and, lt, asc, sql } from "drizzle-orm";
import type { Db } from "../client";
import { wager, type WagerRow, type WagerStatus } from "../schema/wager";

export type PlaceWagerInput = {
  weekStart: string;
  stakeGold: number;
  placedAt: number;
};

export class WagerRepo {
  constructor(private readonly db: Db) {}

  async byWeek(weekStart: string): Promise<WagerRow | null> {
    const rows = await this.db
      .select()
      .from(wager)
      .where(eq(wager.weekStart, weekStart))
      .limit(1);
    return rows[0] ?? null;
  }

  /** onConflictDoNothing: the week is the key, so a second stake is refused. */
  async place(input: PlaceWagerInput): Promise<void> {
    await this.db
      .insert(wager)
      .values(input)
      .onConflictDoNothing({ target: wager.weekStart });
  }

  /**
   * Only the FIRST call decides a week, matching TitleRepo.earn. A cron that
   * retries must not be able to turn a recorded win into a loss, or pay a
   * second time.
   */
  async resolve(
    weekStart: string,
    status: WagerStatus,
    at: number,
  ): Promise<void> {
    await this.db
      .update(wager)
      .set({ status, resolvedAt: at })
      .where(
        sql`${wager.weekStart} = ${weekStart} AND ${wager.status} = 'active'`,
      );
  }

  /** Unresolved wagers from weeks strictly before `weekStart`, oldest first. */
  async activeBefore(weekStart: string): Promise<WagerRow[]> {
    return this.db
      .select()
      .from(wager)
      .where(and(eq(wager.status, "active"), lt(wager.weekStart, weekStart)))
      .orderBy(asc(wager.weekStart));
  }
}
