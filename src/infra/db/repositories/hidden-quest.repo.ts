import { asc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { hiddenQuest, type HiddenQuestRow } from "../schema/hidden-quest";

export type RevealHiddenQuestInput = {
  id: string;
  name: string;
  revealedDay: string;
  revealedAt: number;
  goldAwarded: number;
};

export class HiddenQuestRepo {
  constructor(private readonly db: Db) {}

  async all(): Promise<HiddenQuestRow[]> {
    return this.db
      .select()
      .from(hiddenQuest)
      .orderBy(asc(hiddenQuest.revealedAt));
  }

  async byId(id: string): Promise<HiddenQuestRow | null> {
    const rows = await this.db
      .select()
      .from(hiddenQuest)
      .where(eq(hiddenQuest.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Returns true only for the call whose own insert actually wrote the row.
   *
   * The caller pays gold on the strength of that boolean, so a
   * check-then-insert would leave a window where the daily cron and a page
   * read both see "not revealed" and both pay. Comparing stored values
   * against the input isn't safe either — two concurrent callers can pass
   * identical payloads (e.g. both derived from the same clock reading), so
   * a re-read-and-compare would tell both of them they won. `.returning()`
   * on an insert with `onConflictDoNothing` only yields a row for the call
   * whose insert actually committed one; on conflict it yields nothing, no
   * matter what that call's payload was. That ties the boolean to this
   * call's own insert outcome instead of to payload equality.
   */
  async reveal(input: RevealHiddenQuestInput): Promise<boolean> {
    const inserted = await this.db
      .insert(hiddenQuest)
      .values(input)
      .onConflictDoNothing({ target: hiddenQuest.id })
      .returning({ id: hiddenQuest.id });
    return inserted.length > 0;
  }
}
