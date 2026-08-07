import { eq, sql, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { title, type TitleRow } from "../schema/title";

export type SeedTitleInput = {
  id: string;
  name: string;
  earnedAt: number | null;
};

export class TitleRepo {
  constructor(private readonly db: Db) {}

  async all(): Promise<TitleRow[]> {
    return this.db.select().from(title).orderBy(title.id);
  }

  async byId(id: string): Promise<TitleRow | null> {
    const rows = await this.db
      .select()
      .from(title)
      .where(eq(title.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Safe to call on every deploy — inserts what is missing and leaves what
   * is there alone, so a stored earnedAt is never reset.
   */
  async seed(rows: SeedTitleInput[]): Promise<void> {
    for (const row of rows) {
      await this.db
        .insert(title)
        .values(row)
        .onConflictDoNothing({ target: title.id });
    }
  }

  /** Only the FIRST call stamps earnedAt — earning a title happens once. */
  async earn(id: string, at: number): Promise<void> {
    await this.db
      .update(title)
      .set({ earnedAt: at })
      .where(sql`${title.id} = ${id} AND ${isNull(title.earnedAt)}`);
  }
}
