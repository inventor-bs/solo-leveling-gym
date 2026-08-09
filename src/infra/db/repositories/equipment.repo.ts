import { eq, asc } from "drizzle-orm";
import type { Db } from "../client";
import { equipment, type EquipmentRow } from "../schema/equipment";

export class EquipmentRepo {
  constructor(private readonly db: Db) {}

  async all(): Promise<EquipmentRow[]> {
    return this.db.select().from(equipment).orderBy(asc(equipment.slot));
  }

  async bySlot(slot: string): Promise<EquipmentRow | null> {
    const rows = await this.db
      .select()
      .from(equipment)
      .where(eq(equipment.slot, slot))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Writes the slot unconditionally. The "only replace with a better
   * grade" rule is a game rule and lives in the app-service that decides
   * to call this, not in a repository that would then be enforcing it
   * silently for every future caller.
   */
  async put(slot: string, grade: string, droppedAt: number): Promise<void> {
    await this.db
      .insert(equipment)
      .values({ slot, grade, droppedAt })
      .onConflictDoUpdate({
        target: equipment.slot,
        set: { grade, droppedAt },
      });
  }
}
