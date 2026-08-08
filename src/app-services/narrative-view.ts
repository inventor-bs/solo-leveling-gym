import { toTrainingDay } from "@/core/shared/training-day";
import { arcStageFor, sealedCount } from "@/core/narrative/arc";
import { fragmentById, type ArcStage } from "@/core/narrative/fragments";
import type { Container } from "@/server/container";
import { ensureNarrativeUnlocks } from "./ensure-narrative";

export type NarrativeFragmentView = {
  id: string;
  ordinal: number;
  title: string;
  body: string;
  unlockedDay: string;
};

export type NarrativeView = {
  arcStage: ArcStage;
  fragments: NarrativeFragmentView[];
  sealedCount: number;
  /** Set only on the day a fragment was unlocked, so the HUD can announce it once. */
  unlockedToday: NarrativeFragmentView | null;
};

/**
 * Everything the Archive and the Dashboard need about the arc.
 *
 * Advances the arc before reading it, for the same reason the Quests page
 * issues a quest before showing one: a delayed cron must not make a
 * calendar-gated beat arrive late.
 */
export async function getNarrativeView(
  container: Container,
): Promise<NarrativeView> {
  await ensureNarrativeUnlocks(container);

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const rows = await container.narrative.all();

  const fragments: NarrativeFragmentView[] = [];
  for (const row of rows) {
    // A row whose id is not in the catalog can only come from a hand-edited
    // database; it is skipped rather than rendered as a blank card.
    const def = fragmentById(row.id);
    if (!def) continue;
    fragments.push({
      id: def.id,
      ordinal: def.ordinal,
      title: def.title,
      body: def.body,
      unlockedDay: row.unlockedDay,
    });
  }

  const ids = fragments.map((f) => f.id);
  return {
    arcStage: arcStageFor(ids),
    fragments,
    sealedCount: sealedCount(ids),
    unlockedToday: fragments.find((f) => f.unlockedDay === today) ?? null,
  };
}
