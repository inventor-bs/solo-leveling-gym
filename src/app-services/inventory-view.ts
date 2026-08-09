import { epoch } from "@/core/shared/units";
import { toTrainingDay } from "@/core/shared/training-day";
import {
  EQUIPMENT_CATALOG,
  gradeBonus,
  isEquipmentGrade,
} from "@/core/economy/equipment";
import {
  EQUIPMENT_SLOTS,
  type EquipmentGrade,
  type EquipmentSlot,
} from "@/core/economy/pricing";
import type { Container } from "@/server/container";

export type EquipmentSlotView = {
  slot: EquipmentSlot;
  name: string;
  effect: string;
  grade: EquipmentGrade | null;
  /** The grade's effect size as a whole percentage, or 0 for an empty slot. */
  bonusPercent: number;
  droppedDay: string | null;
};

/**
 * All three slots, always, so the page can show what is missing as well as
 * what is held — an empty slot is information, not an absence.
 *
 * A grade string the catalog does not name is treated as an empty slot
 * rather than trusted, the same guard the buff lookups apply.
 */
export async function getInventoryView(
  container: Container,
): Promise<EquipmentSlotView[]> {
  const rows = await container.equipment.all();
  const bySlot = new Map(rows.map((r) => [r.slot, r]));

  return EQUIPMENT_SLOTS.map((slot) => {
    const def = EQUIPMENT_CATALOG[slot];
    const row = bySlot.get(slot);
    const grade =
      row !== undefined && isEquipmentGrade(row.grade) ? row.grade : null;

    return {
      slot,
      name: def.name,
      effect: def.effect,
      grade,
      bonusPercent: Math.round(gradeBonus(grade) * 100),
      droppedDay:
        grade === null || row === undefined
          ? null
          : toTrainingDay(epoch(row.droppedAt), container.tzOffsetMinutes),
    };
  });
}
