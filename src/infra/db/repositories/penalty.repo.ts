import { isNull, isNotNull, desc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "../client";
import { penalty, type PenaltyRow } from "../schema/penalty";

export type CreatePenaltyInput = {
  id: string;
  startedDay: string;
  startedAt: number;
  reason: string;
  variantId: number;
  expLost: number;
};

export class PenaltyRepo {
  constructor(private readonly db: Db) {}

  /** A null endedAt is the only definition of "still inside". */
  async active(): Promise<PenaltyRow | null> {
    const rows = await this.db
      .select()
      .from(penalty)
      .where(isNull(penalty.endedAt))
      .orderBy(desc(penalty.startedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: CreatePenaltyInput): Promise<PenaltyRow> {
    await this.db.insert(penalty).values(input);
    const rows = await this.db
      .select()
      .from(penalty)
      .where(eq(penalty.id, input.id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error("PenaltyRepo.create: failed to read back after insert");
    }
    return row;
  }

  async close(id: string, at: number): Promise<void> {
    await this.db
      .update(penalty)
      .set({ endedAt: at })
      .where(eq(penalty.id, id));
  }

  /** Every episode ever, open or closed — the variant rotates on this. */
  async countAll(): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(penalty);
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * How many episodes the hunter has escaped. A closed episode IS an exit —
   * `close` is only ever called from exitPenalty, which refuses until the
   * Survival Quest is done, so there is no other way for endedAt to be set.
   */
  async countExited(): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(penalty)
      .where(isNotNull(penalty.endedAt));
    return Number(rows[0]?.n ?? 0);
  }

  /** When the hunter last escaped, or null if they never have. */
  async lastExitAt(): Promise<number | null> {
    const rows = await this.db
      .select({ endedAt: penalty.endedAt })
      .from(penalty)
      .where(isNotNull(penalty.endedAt))
      .orderBy(desc(penalty.endedAt))
      .limit(1);
    return rows[0]?.endedAt ?? null;
  }

  /**
   * Every episode that started on or before `to` — open or closed, and
   * regardless of how its `startedDay` compares to `from`. A closed episode
   * can start before `from` and still end inside [from, to], so filtering
   * on `startedDay >= from` here would silently drop rows the caller needs.
   * This does not filter on `endedAt` at all: an episode's end day isn't
   * knowable without converting its epoch `endedAt` through the hunter's
   * timezone offset, which this repo has no access to (only `db`) — that
   * conversion, and the exact overlap check against `from`, belong to the
   * caller, which already has tzOffsetMinutes. Episodes entirely before
   * `from` (closed with no overlap at all) can also come back here; that is
   * an accepted over-fetch since penalty episodes are rare in this
   * single-user app, and the caller's overlap check filters them out.
   * `from` is kept in the signature — unused in the query itself — to match
   * the `between(from, to)` shape of the other repos' range queries.
   */
  async between(_from: string, to: string): Promise<PenaltyRow[]> {
    return this.db.select().from(penalty).where(lte(penalty.startedDay, to));
  }
}
