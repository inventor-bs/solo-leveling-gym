import { ok, err, type Result } from "@/core/shared/result";
import { isSkillId, skillById } from "@/core/skill/catalog";
import { apEarnedForLevel } from "@/core/skill/ability-points";
import type { Rank } from "@/core/hunter/progression";
import type { Container } from "@/server/container";

export type LearnSkillResult = { skillId: string; apRemaining: number };

export type LearnSkillError =
  | { type: "hunter-not-found" }
  | { type: "unknown-skill" }
  | { type: "already-learned" }
  | { type: "insufficient-ap" };

/**
 * Spends no gold. AP is earned purely from level and rank (Task 2), so
 * there is nothing here for a purchase to bypass — every check is a read.
 */
export async function learnSkill(
  container: Container,
  skillId: string,
): Promise<Result<LearnSkillResult, LearnSkillError>> {
  if (!isSkillId(skillId)) return err({ type: "unknown-skill" });
  const def = skillById(skillId)!;

  const hunter = await container.hunters.get();
  if (!hunter) return err({ type: "hunter-not-found" });

  const row = await container.skills.byId(skillId);
  if (row?.learnedAt != null) return err({ type: "already-learned" });

  const learnedRows = await container.skills.all();
  const spent = learnedRows
    .filter((r) => r.learnedAt !== null)
    .reduce((sum, r) => sum + (skillById(r.skillId)?.apCost ?? 0), 0);

  const earned = apEarnedForLevel(hunter.level, hunter.rank as Rank);
  const available = earned - spent;
  if (available < def.apCost) return err({ type: "insufficient-ap" });

  await container.skills.learn(skillId, container.clock.now());

  return ok({ skillId, apRemaining: available - def.apCost });
}
