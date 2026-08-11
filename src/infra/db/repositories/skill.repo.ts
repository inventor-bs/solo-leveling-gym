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

  /** Moves one banked session into a pending credit, ready to be consumed by the next startSession call. */
  async withdraw(): Promise<void> {
    await this.db
      .update(sessionBank)
      .set({
        bankedSessions: sql`${sessionBank.bankedSessions} - 1`,
        pendingCredits: sql`${sessionBank.pendingCredits} + 1`,
      })
      .where(eq(sessionBank.id, SESSION_BANK_ID));
  }

  /** Consumes exactly one pending credit, if any. Called once per startSession. */
  async consumeCredit(): Promise<boolean> {
    const current = await this.bank();
    if (current.pendingCredits <= 0) return false;
    await this.db
      .update(sessionBank)
      .set({ pendingCredits: sql`${sessionBank.pendingCredits} - 1` })
      .where(eq(sessionBank.id, SESSION_BANK_ID));
    return true;
  }
}
