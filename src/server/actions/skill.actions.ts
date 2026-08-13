"use server";

import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { learnSkill, type LearnSkillResult } from "@/app-services/learn-skill";
import { equipSkill, type EquipSkillResult } from "@/app-services/equip-skill";
import {
  buyRuneStone,
  type BuyRuneStoneResult,
} from "@/app-services/buy-rune-stone";
import {
  overrideQuestItem,
  type OverrideQuestItemResult,
} from "@/app-services/override-quest-item";
import {
  swapWeeklySchedule,
  type SwapWeeklyScheduleResult,
} from "@/app-services/swap-weekly-schedule";
import {
  depositSession,
  type DepositSessionResult,
} from "@/app-services/deposit-session";
import {
  withdrawSession,
  type WithdrawSessionResult,
} from "@/app-services/withdraw-session";
import type { ActionResult } from "./action-result";

/**
 * Every action here returns its failure as data. A thrown domain error
 * reaches the browser as an opaque digest in a production build, which is
 * indistinguishable from the app being down at exactly the moment the
 * hunter is trying to spend an Ability Point or a Rune Stone.
 */

const skillIdSchema = z.object({ skillId: z.string().min(1).max(64) });

export async function learnSkillAction(
  input: unknown,
): Promise<ActionResult<LearnSkillResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = skillIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await learnSkill(getContainer(), parsed.data.skillId);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const equipSchema = z.object({
  skillId: z.string().min(1).max(64),
  equip: z.boolean(),
});

export async function equipSkillAction(
  input: unknown,
): Promise<ActionResult<EquipSkillResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = equipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await equipSkill(
    getContainer(),
    parsed.data.skillId,
    parsed.data.equip,
  );
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

export async function buyRuneStoneAction(): Promise<
  ActionResult<BuyRuneStoneResult>
> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await buyRuneStone(getContainer());
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const overrideSchema = z.object({
  field: z.enum(["pushups", "situps", "squats", "runKm"]),
  value: z.number().nonnegative(),
});

export async function overrideQuestItemAction(
  input: unknown,
): Promise<ActionResult<OverrideQuestItemResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await overrideQuestItem(
    getContainer(),
    parsed.data.field,
    parsed.data.value,
  );
  if (!result.ok) {
    // The app-service's own "quest-not-found" also covers an invalid field
    // name, not only a missing quest row. Remapped to a distinct action
    // error so the message shown here doesn't blur those two causes into
    // one misleading sentence.
    const mapped =
      result.error.type === "quest-not-found"
        ? "quest-not-found-override"
        : result.error.type;
    return { ok: false, error: mapped };
  }
  return { ok: true, value: result.value };
}

const swapSchema = z.object({
  weekdayFrom: z.number().int().min(1).max(7),
  weekdayTo: z.number().int().min(1).max(7),
});

export async function swapWeeklyScheduleAction(
  input: unknown,
): Promise<ActionResult<SwapWeeklyScheduleResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await swapWeeklySchedule(
    getContainer(),
    parsed.data.weekdayFrom,
    parsed.data.weekdayTo,
  );
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

export async function depositSessionAction(): Promise<
  ActionResult<DepositSessionResult>
> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await depositSession(getContainer());
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

export async function withdrawSessionAction(): Promise<
  ActionResult<WithdrawSessionResult>
> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await withdrawSession(getContainer());
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}
