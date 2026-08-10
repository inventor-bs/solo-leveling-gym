import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  hunterSkill,
  skillSlotUnlock,
  SKILL_SLOT_UNLOCK_ID,
  type HunterSkillRow,
} from "../schema/skill";

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
  }

  /** Only the FIRST call stamps learnedAt — AP is spent once, permanently. */
  async learn(id: string, at: number): Promise<void> {
    await this.db
      .update(hunterSkill)
      .set({ learnedAt: at })
      .where(sql`${hunterSkill.skillId} = ${id} AND ${isNull(hunterSkill.learnedAt)}`);
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
}
