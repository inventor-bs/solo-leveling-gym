import { deriveStats, type Stats } from "@/core/hunter/stats";
import {
  expToNextLevel,
  rankForLevel,
  type Rank,
} from "@/core/hunter/progression";
import { fatigueLevel, type FatigueLevel } from "@/core/hunter/fatigue";
import { applyPenaltyToStats } from "@/core/penalty/penalty";
import { TITLE_CATALOG } from "@/core/title/catalog";
import type { ShadowGrade } from "@/core/shadow/grade";
import type { Container } from "@/server/container";
import { buildStatInput } from "./stat-input";
import { getLiftTrends, type LiftTrendEntry } from "./lift-trends";
import { equippedTitleId } from "./equipped-title";
import { getShadowArmyView } from "./shadow-view";

export type TitleViewEntry = {
  id: string;
  name: string;
  condition: string;
  buff: string;
  earned: boolean;
  equipped: boolean;
};

export type StatusView = {
  name: string;
  level: number;
  exp: number;
  expToNext: number;
  rank: Rank;
  gold: number;
  /** Written at Job Change, which does not exist yet — null for now. */
  className: string | null;
  fatigue: number;
  fatigueLevel: FatigueLevel;
  armyRank: ShadowGrade | null;
  /** What the hunter is shown: measured, with the Penalty Zone adjustment. */
  stats: Stats;
  /** The untouched derivation. Nothing ever writes this back to the hunter row. */
  measuredStats: Stats;
  penaltyActive: boolean;
  lifts: LiftTrendEntry[];
  titles: TitleViewEntry[];
  equippedTitleId: string | null;
};

export async function getStatusView(
  container: Container,
): Promise<StatusView | null> {
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const measuredStats = deriveStats(await buildStatInput(container));
  const penaltyActive = (await container.penalties.active()) !== null;

  const equipped = await equippedTitleId(container, hunter);
  const rows = await container.titles.all();
  const titles: TitleViewEntry[] = TITLE_CATALOG.map((def) => {
    const row = rows.find((r) => r.id === def.id);
    return {
      id: def.id,
      name: def.name,
      condition: def.condition,
      buff: def.buff,
      earned: row !== undefined && row.earnedAt !== null,
      equipped: equipped === def.id,
    };
  });

  const army = await getShadowArmyView(container);

  return {
    name: hunter.name,
    level: hunter.level,
    exp: hunter.exp,
    expToNext: expToNextLevel(hunter.level),
    rank: rankForLevel(hunter.level),
    gold: hunter.gold,
    className: hunter.className,
    fatigue: hunter.fatigue,
    fatigueLevel: fatigueLevel(hunter.fatigue),
    armyRank: army.armyRank,
    // Two copies on purpose: the adjustment is applied here, at the read
    // layer, and the measured value travels alongside it untouched.
    stats: applyPenaltyToStats(measuredStats, penaltyActive),
    measuredStats,
    penaltyActive,
    lifts: await getLiftTrends(container),
    titles,
    equippedTitleId: equipped,
  };
}
