import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { exercise, type ExerciseRow } from "../schema/catalog";

export class ExerciseRepo {
  constructor(private readonly db: Db) {}

  async byId(id: string): Promise<ExerciseRow | null> {
    const rows = await this.db
      .select()
      .from(exercise)
      .where(eq(exercise.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async all(): Promise<ExerciseRow[]> {
    return this.db.select().from(exercise);
  }
}
