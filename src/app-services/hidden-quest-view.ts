import {
  SEVENTH_DAY,
  FIVE_DAY_STREAK,
  FIRST_RECORD,
  EARLY_RISER,
} from "@/core/quest/hidden-quest";
import type { Container } from "@/server/container";
import { revealHiddenQuests } from "./reveal-hidden-quests";

export type HiddenQuestEntry = {
  id: string;
  name: string;
  revealLine: string;
  goldAwarded: number;
  revealedDay: string;
};

const REVEAL_LINES = new Map<string, string>([
  [SEVENTH_DAY.id, SEVENTH_DAY.revealLine],
  [FIVE_DAY_STREAK.id, FIVE_DAY_STREAK.revealLine],
  [FIRST_RECORD.id, FIRST_RECORD.revealLine],
  [EARLY_RISER.id, EARLY_RISER.revealLine],
]);

/**
 * Only revealed quests, ever. There is no "pending hidden quest" shape here
 * and no field a UI could use to render one — a hidden quest that could be
 * seen while incomplete is not hidden.
 *
 * Reveals before reading, so the day-7 card lands on day 7 rather than
 * whenever the platform gets around to running the cron.
 */
export async function getHiddenQuestView(
  container: Container,
): Promise<HiddenQuestEntry[]> {
  await revealHiddenQuests(container);

  const rows = await container.hiddenQuests.all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    revealLine: REVEAL_LINES.get(row.id) ?? "",
    goldAwarded: row.goldAwarded,
    revealedDay: row.revealedDay,
  }));
}
