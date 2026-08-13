import { deriveStats, type Stats } from "@/core/hunter/stats";
import {
  expToNextLevel,
  rankForLevel,
  type Rank,
} from "@/core/hunter/progression";
import { fatigueLevel, type FatigueLevel } from "@/core/hunter/fatigue";
import { applyPenaltyToStats } from "@/core/penalty/penalty";
import { TITLE_CATALOG } from "@/core/title/catalog";
import {
  JOB_CHANGE_MIN_LEVEL,
  JOB_CHANGE_TARGET_CLEARS,
} from "@/core/skill/job-change";
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

export type JobChangeView = {
  attempted: boolean;
  consecutiveCleared: number;
  target: number;
  failed: boolean;
};

export type StatusView = {
  name: string;
  level: number;
  exp: number;
  expToNext: number;
  rank: Rank;
  gold: number;
  /** Written once a Job Change Quest completes; null before that. */
  className: string | null;
  /** Null once classed, or below the eligible level — nothing to show. */
  jobChange: JobChangeView | null;
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
  const attempt = await container.skills.jobChangeAttempt();

  return {
    name: hunter.name,
    level: hunter.level,
    exp: hunter.exp,
    expToNext: expToNextLevel(hunter.level),
    rank: rankForLevel(hunter.level),
    gold: hunter.gold,
    className: hunter.className,
    jobChange:
      hunter.level >= JOB_CHANGE_MIN_LEVEL && hunter.className === null
        ? {
            attempted: attempt !== null,
            consecutiveCleared: attempt?.consecutiveCleared ?? 0,
            target: JOB_CHANGE_TARGET_CLEARS,
            failed: attempt?.failedAt != null,
          }
        : null,
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
