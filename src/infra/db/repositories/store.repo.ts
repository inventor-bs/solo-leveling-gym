import { eq, asc } from "drizzle-orm";
import type { Db } from "../client";
import {
  storeUnlock,
  pendingChallenge,
  demonCastleProgress,
  PENDING_CHALLENGE_ID,
  DEMON_CASTLE_PROGRESS_ID,
  type PendingChallengeRow,
} from "../schema/store";

export type SetPendingChallengeInput = {
  type: string;
  purchasedAt: number;
  floor: number | null;
};

/**
 * Owns the three tables a Store purchase writes to. Grouped the way
 * TrainingRepo groups session/set_log/run_log: by subsystem, not one class
 * per table — all three are written by the purchase flow and read by the
 * same two callers.
 */
export class StoreRepo {
  constructor(private readonly db: Db) {}

  async unlockedKeys(): Promise<string[]> {
    const rows = await this.db
      .select({ key: storeUnlock.key })
      .from(storeUnlock)
      .orderBy(asc(storeUnlock.key));
    return rows.map((r) => r.key);
  }

  async isUnlocked(key: string): Promise<boolean> {
    const rows = await this.db
      .select({ key: storeUnlock.key })
      .from(storeUnlock)
      .where(eq(storeUnlock.key, key))
      .limit(1);
    return rows.length > 0;
  }

  /** onConflictDoNothing so a repeated purchase never rewrites the original date. */
  async unlock(key: string, at: number): Promise<void> {
    await this.db
      .insert(storeUnlock)
      .values({ key, unlockedAt: at })
      .onConflictDoNothing({ target: storeUnlock.key });
  }

  async pendingChallenge(): Promise<PendingChallengeRow | null> {
    const rows = await this.db
      .select()
      .from(pendingChallenge)
      .where(eq(pendingChallenge.id, PENDING_CHALLENGE_ID))
      .limit(1);
    return rows[0] ?? null;
  }

  async setPendingChallenge(input: SetPendingChallengeInput): Promise<void> {
    await this.db
      .insert(pendingChallenge)
      .values({ id: PENDING_CHALLENGE_ID, ...input })
      .onConflictDoUpdate({
        target: pendingChallenge.id,
        set: {
          type: input.type,
          purchasedAt: input.purchasedAt,
          floor: input.floor,
        },
      });
  }

  async clearPendingChallenge(): Promise<void> {
    await this.db
      .delete(pendingChallenge)
      .where(eq(pendingChallenge.id, PENDING_CHALLENGE_ID));
  }

  async highestFloorCleared(): Promise<number> {
    const rows = await this.db
      .select()
      .from(demonCastleProgress)
      .where(eq(demonCastleProgress.id, DEMON_CASTLE_PROGRESS_ID))
      .limit(1);
    // No row yet means nothing has been cleared, which is floor 0. Seeding
    // a zero row up front would be a migration that says the same thing.
    return rows[0]?.highestFloorCleared ?? 0;
  }

  async setHighestFloorCleared(floor: number): Promise<void> {
    await this.db
      .insert(demonCastleProgress)
      .values({ id: DEMON_CASTLE_PROGRESS_ID, highestFloorCleared: floor })
      .onConflictDoUpdate({
        target: demonCastleProgress.id,
        set: { highestFloorCleared: floor },
      });
  }
}
