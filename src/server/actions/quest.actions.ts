"use server";

import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import {
  logQuestProgress,
  type LogQuestProgressResult,
} from "@/app-services/log-quest-progress";
import { isTrainingDay } from "@/core/shared/training-day";
import type { ActionResult } from "./action-result";

/**
 * A per-call cap. Nothing here is a competitive number, but an accidental
 * extra digit should not silently become the day's record.
 */
const REP_CEILING = 1000;
const reps = z.number().int().min(0).max(REP_CEILING).optional();

const schema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pushups: reps,
  situps: reps,
  squats: reps,
});

export async function logQuestProgressAction(
  input: unknown,
): Promise<ActionResult<LogQuestProgressResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  // The regex admits shapes the calendar does not, such as 2026-02-30.
  // isTrainingDay is the runtime guard and narrows the type in one step,
  // so nothing here can throw on a bad date.
  const day = parsed.data.day;
  if (!isTrainingDay(day)) return { ok: false, error: "invalid-input" };

  const result = await logQuestProgress(getContainer(), {
    ...parsed.data,
    day,
  });
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}
