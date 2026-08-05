import { eq } from "drizzle-orm";
import type { Epoch } from "@/core/shared/units";
import type { Db } from "../client";
import { processedAction } from "../schema/system";

export class IdempotencyRepo {
  constructor(private readonly db: Db) {}

  async find<T>(id: string): Promise<T | null> {
    const rows = await this.db
      .select()
      .from(processedAction)
      .where(eq(processedAction.id, id))
      .limit(1);
    const row = rows[0];
    return row ? (JSON.parse(row.resultJson) as T) : null;
  }

  /**
   * Stores the first result. A later call with the same id does NOT
   * overwrite it — the first result is the only correct one.
   */
  async remember<T>(id: string, result: T, at: Epoch): Promise<void> {
    await this.db
      .insert(processedAction)
      .values({ id, resultJson: JSON.stringify(result), createdAt: at })
      .onConflictDoNothing();
  }
}
