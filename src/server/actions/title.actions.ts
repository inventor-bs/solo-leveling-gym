"use server";

import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { equipTitle, type EquipTitleResult } from "@/app-services/equip-title";
import type { ActionResult } from "./action-result";

const schema = z.object({
  /** Null takes the current title off. */
  titleId: z.string().min(1).nullable(),
});

export async function equipTitleAction(
  input: unknown,
): Promise<ActionResult<EquipTitleResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await equipTitle(getContainer(), parsed.data.titleId);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}
