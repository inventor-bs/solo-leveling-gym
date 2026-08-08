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
   * Returns true only for the call that actually wrote the row.
   *
   * The caller pays gold on the strength of that boolean, so a
   * check-then-insert would leave a window where the daily cron and a page
   * read both see "not revealed" and both pay. Inserting first and then
   * comparing the stored instant against the one this call passed closes
   * it: whichever call wrote the row is the only one whose instant is
   * there to find.
   */
  async reveal(input: RevealHiddenQuestInput): Promise<boolean> {
    await this.db
      .insert(hiddenQuest)
      .values(input)
      .onConflictDoNothing({ target: hiddenQuest.id });
    const row = await this.byId(input.id);
    return row !== null && row.revealedAt === input.revealedAt;
  }
}
