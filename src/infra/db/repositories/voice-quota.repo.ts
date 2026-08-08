import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { voiceQuota } from "../schema/voice";
import { emptyQuota, type QuotaState } from "@/core/system-voice/quota";

export class VoiceQuotaRepo {
  constructor(private readonly db: Db) {}

  /**
   * A missing row is a fresh budget, not an error. This is also how the
   * circuit breaker closes: a new day has no row, so it cannot be tripped,
   * and no timer has to be right for that to work.
   */
  async forDay(day: string): Promise<QuotaState> {
    const rows = await this.db
      .select()
      .from(voiceQuota)
      .where(eq(voiceQuota.day, day))
      .limit(1);
    const row = rows[0];
    if (!row) return emptyQuota();
    return {
      requests: row.requests,
      consecutiveFailures: row.consecutiveFailures,
      tripped: row.trippedAt !== null,
    };
  }

  async save(day: string, state: QuotaState): Promise<void> {
    const values = {
      day,
      requests: state.requests,
      consecutiveFailures: state.consecutiveFailures,
      // The instant is not read back — `tripped` is derived from its
      // presence — but it is kept for the operator staring at the table
      // wondering when the day went wrong.
      trippedAt: state.tripped ? Date.now() : null,
    };
    await this.db
      .insert(voiceQuota)
      .values(values)
      .onConflictDoUpdate({ target: voiceQuota.day, set: values });
  }
}
