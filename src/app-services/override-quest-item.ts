import { ok, err, type Result } from "@/core/shared/result";
import { toTrainingDay } from "@/core/shared/training-day";
import type { QuestTargetField } from "@/infra/db/repositories/quest.repo";
import type { Container } from "@/server/container";
import { ensureDailyQuest } from "./ensure-daily-quest";

export type OverrideQuestItemResult = {
  field: QuestTargetField;
  newValue: number;
};

export type OverrideQuestItemError =
  | { type: "skill-not-equipped" }
  | { type: "already-overridden-today" }
  | { type: "quest-not-found" };

const FIELDS: readonly QuestTargetField[] = [
  "pushups",
  "situps",
  "squats",
  "runKm",
];

function isQuestTargetField(value: string): value is QuestTargetField {
  return (FIELDS as readonly string[]).includes(value);
}

/**
 * Ruler's Authority: replaces one of today's already-materialized Daily
 * Quest targets. Writes straight onto the `daily_quest` row instead of
 * layering an override-application step on top of it — the row already IS
 * the day's targets, so there is nothing else to reconcile at read time.
 */
export async function overrideQuestItem(
  container: Container,
  field: string,
  value: number,
): Promise<Result<OverrideQuestItemResult, OverrideQuestItemError>> {
  const equippedSkills = new Set(await container.skills.equippedIds());
  if (!equippedSkills.has("rulers-authority")) {
    return err({ type: "skill-not-equipped" });
  }
  if (!isQuestTargetField(field)) {
    return err({ type: "quest-not-found" });
  }

  const today = toTrainingDay(container.clock.now(), container.tzOffsetMinutes);
  const existing = await container.quests.overrideOnDay(today);
  if (existing) return err({ type: "already-overridden-today" });

  const quest = await ensureDailyQuest(container, today);
  if (!quest.ok) return err({ type: "quest-not-found" });

  const previousValue = {
    pushups: quest.value.targetPushups,
    situps: quest.value.targetSitups,
    squats: quest.value.targetSquats,
    runKm: quest.value.targetRunKm,
  }[field];

  await container.quests.setTarget(today, field, value);
  await container.quests.recordOverride(
    today,
    field,
    previousValue,
    value,
    container.clock.now(),
  );

  return ok({ field, newValue: value });
}
