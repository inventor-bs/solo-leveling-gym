import { eq, sql, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { shadow, type ShadowRow } from "../schema/shadow";

export type SeedShadowInput = {
  id: string;
  name: string;
  muscle: string | null;
  extractedAt: number | null;
};

export class ShadowRepo {
  constructor(private readonly db: Db) {}

  async all(): Promise<ShadowRow[]> {
    return this.db.select().from(shadow).orderBy(shadow.id);
  }

  async byId(id: string): Promise<ShadowRow | null> {
    const rows = await this.db
      .select()
      .from(shadow)
      .where(eq(shadow.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Safe to call repeatedly — upserts by primary key, never resets progress. */
  async seed(rows: SeedShadowInput[]): Promise<void> {
    for (const row of rows) {
      await this.db
        .insert(shadow)
        .values(row)
        .onConflictDoNothing({ target: shadow.id });
    }
  }

  async addExp(id: string, delta: number, trainedDay: string): Promise<void> {
    if (delta <= 0) return;
    await this.db
      .update(shadow)
      .set({
        exp: sql`${shadow.exp} + ${delta}`,
        lastTrainedDay: trainedDay,
      })
      .where(eq(shadow.id, id));
  }

  /** Only the FIRST call sets extractedAt — ARISE is a one-time moment. */
  async extract(id: string, at: number): Promise<void> {
    await this.db
      .update(shadow)
      .set({ extractedAt: at })
      .where(sql`${shadow.id} = ${id} AND ${isNull(shadow.extractedAt)}`);
  }
}
