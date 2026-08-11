import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  hunterSkill,
  skillSlotUnlock,
  SKILL_SLOT_UNLOCK_ID,
  type HunterSkillRow,
} from "../schema/skill";
import {
  weeklyScheduleSwap,
  type WeeklyScheduleSwapRow,
} from "../schema/weekly-schedule-swap";
import {
  sessionBank,
  SESSION_BANK_ID,
  type SessionBankRow,
} from "../schema/session-bank";
import {
  jobChangeQuest,
  JOB_CHANGE_QUEST_ID,
  type JobChangeQuestRow,
} from "../schema/job-change-quest";

export type SeedSkillInput = { id: string };

export class SkillRepo {
  constructor(private readonly db: Db) {}

  async all(): Promise<HunterSkillRow[]> {
    return this.db.select().from(hunterSkill).orderBy(hunterSkill.skillId);
  }

  async byId(id: string): Promise<HunterSkillRow | null> {
    const rows = await this.db
      .select()
      .from(hunterSkill)
      .where(eq(hunterSkill.skillId, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Safe on every deploy — never resets an already-learned/equipped row. */
  async seed(rows: SeedSkillInput[]): Promise<void> {
    for (const row of rows) {
      await this.db
        .insert(hunterSkill)
        .values({ skillId: row.id, learnedAt: null, equippedAt: null })
        .onConflictDoNothing({ target: hunterSkill.skillId });
    }
    await this.db
      .insert(skillSlotUnlock)
      .values({ id: SKILL_SLOT_UNLOCK_ID, slotsPurchased: 0 })
      .onConflictDoNothing({ target: skillSlotUnlock.id });
    await this.db
      .insert(sessionBank)
      .values({
        id: SESSION_BANK_ID,
        bankedSessions: 0,
        pendingCredits: 0,
        lastDepositedSessionId: null,
      })
      .onConflictDoNothing({ target: sessionBank.id });
  }

  /** Only the FIRST call stamps learnedAt — AP is spent once, permanently. */
  async learn(id: string, at: number): Promise<void> {
    await this.db
      .update(hunterSkill)
      .set({ learnedAt: at })
      .where(
        sql`${hunterSkill.skillId} = ${id} AND ${isNull(hunterSkill.learnedAt)}`,
      );
  }

  async equip(id: string, at: number): Promise<void> {
    await this.db
      .update(hunterSkill)
      .set({ equippedAt: at })
      .where(eq(hunterSkill.skillId, id));
  }

  async unequip(id: string): Promise<void> {
    await this.db
      .update(hunterSkill)
      .set({ equippedAt: null })
      .where(eq(hunterSkill.skillId, id));
  }

  async equippedIds(): Promise<string[]> {
    const rows = await this.db
      .select({ skillId: hunterSkill.skillId })
      .from(hunterSkill)
      .where(sql`${hunterSkill.equippedAt} IS NOT NULL`);
    return rows.map((r) => r.skillId);
  }

  async slotsPurchased(): Promise<number> {
    const rows = await this.db
      .select({ n: skillSlotUnlock.slotsPurchased })
      .from(skillSlotUnlock)
      .where(eq(skillSlotUnlock.id, SKILL_SLOT_UNLOCK_ID))
      .limit(1);
    return rows[0]?.n ?? 0;
  }

  /** Increments in SQL, same reasoning as QuestRepo.addProgress: two taps at once must not lose one. */
  async purchaseSlot(): Promise<void> {
    await this.db
      .update(skillSlotUnlock)
      .set({ slotsPurchased: sql`${skillSlotUnlock.slotsPurchased} + 1` })
      .where(eq(skillSlotUnlock.id, SKILL_SLOT_UNLOCK_ID));
  }

  /** Null when no swap has been recorded for that ISO week's Monday. */
  async swapForWeek(weekStart: string): Promise<WeeklyScheduleSwapRow | null> {
    const rows = await this.db
      .select()
      .from(weeklyScheduleSwap)
      .where(eq(weeklyScheduleSwap.weekStart, weekStart))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * The primary key on `weekStart` already makes a second swap in the same
   * week impossible at the schema level — the caller still checks first so
   * it can return a typed error instead of letting the insert fail.
   */
  async recordSwap(
    weekStart: string,
    weekdayFrom: number,
    weekdayTo: number,
    at: number,
  ): Promise<void> {
    await this.db
      .insert(weeklyScheduleSwap)
      .values({ weekStart, weekdayFrom, weekdayTo, swappedAt: at });
  }

  /** Falls back to an empty singleton when the seed row does not exist yet. */
  async bank(): Promise<SessionBankRow> {
    const rows = await this.db
      .select()
      .from(sessionBank)
      .where(eq(sessionBank.id, SESSION_BANK_ID))
      .limit(1);
    return (
      rows[0] ?? {
        id: SESSION_BANK_ID,
        bankedSessions: 0,
        pendingCredits: 0,
        lastDepositedSessionId: null,
      }
    );
  }

  /** Records the surplus session banked and which session id it came from, for the deposit-once guard. */
  async deposit(sessionId: string, _at: number): Promise<void> {
    await this.db
      .update(sessionBank)
      .set({
        bankedSessions: sql`${sessionBank.bankedSessions} + 1`,
        lastDepositedSessionId: sessionId,
      })
      .where(eq(sessionBank.id, SESSION_BANK_ID));
  }

  /**
   * Moves one banked session into a pending credit, ready to be consumed by
   * the next startSession call. A single atomic conditional UPDATE rather
   * than a read-then-write: the `bankedSessions > 0` guard lives in the same
   * statement that decrements it, so two concurrent calls can never both
   * pass a separate check and drive the counter negative. Returns whether a
   * row was actually changed, so the caller can tell "withdrew" from
   * "nothing to withdraw" without a second read.
   */
  async withdraw(): Promise<boolean> {
    const result = await this.db
      .update(sessionBank)
      .set({
        bankedSessions: sql`${sessionBank.bankedSessions} - 1`,
        pendingCredits: sql`${sessionBank.pendingCredits} + 1`,
      })
      .where(
        sql`${sessionBank.id} = ${SESSION_BANK_ID} AND ${sessionBank.bankedSessions} > 0`,
      );
    return result.rowsAffected > 0;
  }

  /**
   * Consumes exactly one pending credit, if any. Called once per
   * startSession. Same atomic-conditional-UPDATE shape as `withdraw()`: the
   * `pendingCredits > 0` guard is part of the UPDATE's own WHERE clause,
   * not a preceding SELECT, so two concurrent callers can never both read
   * "1 credit available" and both decrement it to -1.
   */
  async consumeCredit(): Promise<boolean> {
    const result = await this.db
      .update(sessionBank)
      .set({ pendingCredits: sql`${sessionBank.pendingCredits} - 1` })
      .where(
        sql`${sessionBank.id} = ${SESSION_BANK_ID} AND ${sessionBank.pendingCredits} > 0`,
      );
    return result.rowsAffected > 0;
  }

  /** Null when no Job Change attempt has ever been started. */
  async jobChangeAttempt(): Promise<JobChangeQuestRow | null> {
    const rows = await this.db
      .select()
      .from(jobChangeQuest)
      .where(eq(jobChangeQuest.id, JOB_CHANGE_QUEST_ID))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Overwrites the singleton row rather than inserting a new one — a fresh
   * attempt (first ever, or a retry after a prior failure) always starts
   * from zero progress with no failure or completion timestamp carried over.
   */
  async startJobChangeAttempt(startedDay: string, _at: number): Promise<void> {
    await this.db
      .insert(jobChangeQuest)
      .values({
        id: JOB_CHANGE_QUEST_ID,
        startedDay,
        consecutiveCleared: 0,
        failedAt: null,
        completedAt: null,
      })
      .onConflictDoUpdate({
        target: jobChangeQuest.id,
        set: {
          startedDay,
          consecutiveCleared: 0,
          failedAt: null,
          completedAt: null,
        },
      });
  }

  async updateJobChangeProgress(consecutiveCleared: number): Promise<void> {
    await this.db
      .update(jobChangeQuest)
      .set({ consecutiveCleared })
      .where(eq(jobChangeQuest.id, JOB_CHANGE_QUEST_ID));
  }

  async completeJobChangeAttempt(at: number): Promise<void> {
    await this.db
      .update(jobChangeQuest)
      .set({ completedAt: at })
      .where(eq(jobChangeQuest.id, JOB_CHANGE_QUEST_ID));
  }

  async failJobChangeAttempt(at: number): Promise<void> {
    await this.db
      .update(jobChangeQuest)
      .set({ failedAt: at })
      .where(eq(jobChangeQuest.id, JOB_CHANGE_QUEST_ID));
  }
}
