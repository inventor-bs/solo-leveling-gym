import {
  daysBetween,
  toTrainingDay,
  type TrainingDay,
} from "@/core/shared/training-day";
import {
  gradeForExp,
  weakenedExp,
  type ShadowGrade,
} from "@/core/shadow/grade";
import {
  armyRank as computeArmyRank,
  type ShadowStanding,
} from "@/core/shadow/army-rank";
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
      };
    }

    const daysSinceTrained =
      row.lastTrainedDay === null
        ? null
        : daysBetween(row.lastTrainedDay as TrainingDay, today);
    const effectiveExp =
      daysSinceTrained === null
        ? row.exp
        : weakenedExp(row.exp, daysSinceTrained);

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
    armyRank: computeArmyRank(standings),
    weakest: weakest
      ? { name: weakest.name, daysSinceTrained: weakest.daysSinceTrained ?? 0 }
      : null,
  };
}
