import { ok, err, type Result } from "@/core/shared/result";
import { isTitleId } from "@/core/title/catalog";
import type { Container } from "@/server/container";

export type EquipTitleResult = { equipped: string | null };

export type EquipTitleError =
  { type: "title-not-found" } | { type: "title-not-earned" };

/**
 * Chooses which earned title the hunter wears. Passing null takes the
 * current one off.
 *
 * Only one title is worn at a time, and that is enforced structurally:
 * hunter.title is a single column, so writing a new id necessarily
 * replaces the old one.
 */
export async function equipTitle(
  container: Container,
  titleId: string | null,
): Promise<Result<EquipTitleResult, EquipTitleError>> {
  if (titleId === null) {
    await container.hunters.update({ title: null });
    return ok({ equipped: null });
  }

  if (!isTitleId(titleId)) return err({ type: "title-not-found" });

  const row = await container.titles.byId(titleId);
  if (row === null) return err({ type: "title-not-found" });
  if (row.earnedAt === null) return err({ type: "title-not-earned" });

  await container.hunters.update({ title: titleId });
  return ok({ equipped: titleId });
}
