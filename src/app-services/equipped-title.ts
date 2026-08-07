import { isTitleId, type TitleId } from "@/core/title/catalog";
import type { HunterRow } from "@/infra/db/schema/hunter";
import type { Container } from "@/server/container";

/**
 * The title the hunter is actually wearing, or null.
 *
 * Takes the already-loaded hunter row so the two call sites that award EXP
 * and gold do not re-read it. Confirms BOTH that the stored value names a
 * real title and that the title was genuinely earned: hunter.title is a
 * plain nullable text column, and a value left behind by a data edit must
 * never be able to hand out a buff nobody trained for.
 */
export async function equippedTitleId(
  container: Container,
  hunter: HunterRow,
): Promise<TitleId | null> {
  const worn = hunter.title;
  if (worn === null || !isTitleId(worn)) return null;

  const row = await container.titles.byId(worn);
  if (row === null || row.earnedAt === null) return null;
  return worn;
}
