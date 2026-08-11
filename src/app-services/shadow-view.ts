import {
  daysBetween,
  parseTrainingDay,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  gradeForExp,
  weakenedExp,
  type ShadowGrade,
} from "@/core/shadow/grade";
import { effectiveDaysInactive } from "@/core/economy/shadow-feed";
import {
  armyRank as computeArmyRank,
  type ShadowStanding,
} from "@/core/shadow/army-rank";
import {
  armyRankMode,
  shadowWeakenAfterDays,
  shadowWeakenRatePerDay,
} from "@/core/skill/buffs";
import type { Container } from "@/server/container";

export type ShadowViewEntry = {
  id: string;
  name: string;
  muscle: string | null;
  extracted: boolean;
  grade: ShadowGrade | null;
  effectiveExp: number;
  daysSinceTrained: number | null;
  weakened: boolean;
  fedUntilDay: string | null;
};

export type ShadowArmyView = {
  shadows: ShadowViewEntry[];
  armyRank: ShadowGrade | null;
  weakest: { name: string; daysSinceTrained: number } | null;
};

export async function getShadowArmyView(
  container: Container,
): Promise<ShadowArmyView> {
  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const rows = await container.shadows.all();
  const feeds = new Map(
    (await container.mitigation.allFeeds()).map((f) => [
      f.shadowId,
      f.extendedUntilDay,
    ]),
  );
  const equippedSkills = new Set(await container.skills.equippedIds());
  const afterDays = shadowWeakenAfterDays(equippedSkills);
  const ratePerDay = shadowWeakenRatePerDay(equippedSkills);

  const entries: ShadowViewEntry[] = rows.map((row) => {
    const extracted = row.extractedAt !== null;
    if (!extracted) {
      return {
        id: row.id,
        name: row.name,
        muscle: row.muscle,
        extracted: false,
        grade: null,
        effectiveExp: 0,
        daysSinceTrained: null,
        weakened: false,
        fedUntilDay: null,
      };
    }

    const daysSinceTrained =
      row.lastTrainedDay === null
        ? null
        : daysBetween(row.lastTrainedDay as TrainingDay, today);

    // Shadow Feed is an ADJUSTMENT: it lowers the day count handed to
    // weakenedExp and never touches row.exp, which stays exactly the volume
    // that was actually lifted.
    const fedUntilDay = feeds.get(row.id) ?? null;
    const feedDaysRemaining =
      fedUntilDay === null
        ? 0
        : daysBetween(today, parseTrainingDay(fedUntilDay));
    const adjustedDaysInactive =
      daysSinceTrained === null
        ? null
        : effectiveDaysInactive(daysSinceTrained, feedDaysRemaining);
    const effectiveExp =
      adjustedDaysInactive === null
        ? row.exp
        : weakenedExp(row.exp, adjustedDaysInactive, afterDays, ratePerDay);

    // Bellion has no grade ladder by design — it's extracted-or-not only.
    const grade = row.muscle === null ? null : gradeForExp(effectiveExp);

    return {
      id: row.id,
      name: row.name,
      muscle: row.muscle,
      extracted: true,
      grade,
      effectiveExp,
      daysSinceTrained,
      weakened: effectiveExp < row.exp,
      fedUntilDay,
    };
  });

  const standings: ShadowStanding[] = entries
    .filter(
      (e): e is ShadowViewEntry & { grade: ShadowGrade } => e.grade !== null,
    )
    .map((e) => ({
      grade: e.grade,
      extracted: e.extracted,
      countsTowardArmy: e.muscle !== null,
    }));

  const weakenedShadows = entries.filter((e) => e.extracted && e.weakened);
  const weakest =
    weakenedShadows.length === 0
      ? null
      : weakenedShadows.reduce((a, b) =>
          (b.daysSinceTrained ?? 0) > (a.daysSinceTrained ?? 0) ? b : a,
        );

  return {
    shadows: entries,
    armyRank: computeArmyRank(standings, armyRankMode(equippedSkills)),
    weakest: weakest
      ? { name: weakest.name, daysSinceTrained: weakest.daysSinceTrained ?? 0 }
      : null,
  };
}
