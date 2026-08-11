import { SKILL_CATALOG, type SkillBranch } from "@/core/skill/catalog";
import { apEarnedForLevel } from "@/core/skill/ability-points";
import { slotCapacity } from "@/core/skill/slots";
import type { Rank } from "@/core/hunter/progression";
import type { Container } from "@/server/container";

export type SkillEntry = {
  id: string;
  name: string;
  branch: SkillBranch;
  apCost: number;
  effect: string;
  learned: boolean;
  equipped: boolean;
};

export type SkillsView = {
  apEarned: number;
  apSpent: number;
  apAvailable: number;
  slotsUsed: number;
  slotCapacity: number;
  skills: SkillEntry[];
};

const emptyView: SkillsView = {
  apEarned: 0,
  apSpent: 0,
  apAvailable: 0,
  slotsUsed: 0,
  slotCapacity: 0,
  skills: [],
};

export async function getSkillsView(container: Container): Promise<SkillsView> {
  const hunter = await container.hunters.get();
  if (!hunter) return emptyView;

  const rows = await container.skills.all();
  const byId = new Map(rows.map((r) => [r.skillId, r]));

  const skills: SkillEntry[] = SKILL_CATALOG.map((def) => {
    const row = byId.get(def.id);
    return {
      id: def.id,
      name: def.name,
      branch: def.branch,
      apCost: def.apCost,
      effect: def.effect,
      learned: row?.learnedAt != null,
      equipped: row?.equippedAt != null,
    };
  });

  const apEarned = apEarnedForLevel(hunter.level, hunter.rank as Rank);
  const apSpent = skills
    .filter((s) => s.learned)
    .reduce((sum, s) => sum + s.apCost, 0);
  const slotsUsed = skills.filter((s) => s.equipped).length;
  const capacity = slotCapacity(await container.skills.slotsPurchased());

  return {
    apEarned,
    apSpent,
    apAvailable: apEarned - apSpent,
    slotsUsed,
    slotCapacity: capacity,
    skills,
  };
}
