import { ok, err, type Result } from "@/core/shared/result";
import { isSkillId } from "@/core/skill/catalog";
import { slotCapacity } from "@/core/skill/slots";
import type { Container } from "@/server/container";

export type EquipSkillResult = { skillId: string; equipped: boolean };

export type EquipSkillError =
  | { type: "unknown-skill" }
  | { type: "not-learned" }
  | { type: "no-free-slot" };

/**
 * Toggles whether a learned skill occupies one of the hunter's slots.
 * Unequipping always succeeds — there is no reason to refuse giving a slot
 * back. Equipping is refused once every slot is full.
 */
export async function equipSkill(
  container: Container,
  skillId: string,
  equip: boolean,
): Promise<Result<EquipSkillResult, EquipSkillError>> {
  if (!isSkillId(skillId)) return err({ type: "unknown-skill" });

  const row = await container.skills.byId(skillId);
  if (row?.learnedAt == null) return err({ type: "not-learned" });

  if (!equip) {
    await container.skills.unequip(skillId);
    return ok({ skillId, equipped: false });
  }

  if (row.equippedAt !== null) return ok({ skillId, equipped: true });

  const equippedIds = await container.skills.equippedIds();
  const capacity = slotCapacity(await container.skills.slotsPurchased());
  if (equippedIds.length >= capacity) return err({ type: "no-free-slot" });

  await container.skills.equip(skillId, container.clock.now());
  return ok({ skillId, equipped: true });
}
