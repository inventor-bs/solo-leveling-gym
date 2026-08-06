"use server";

import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { exitPenalty } from "@/app-services/exit-penalty";
import type { ActionResult } from "./action-result";

export async function escapePenaltyAction(): Promise<
  ActionResult<{ daysStuck: number }>
> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await exitPenalty(getContainer());
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error.type === "no-active-penalty"
          ? "no-active-penalty"
          : "survival-incomplete",
    };
  }
  return { ok: true, value: { daysStuck: result.value.daysStuck } };
}
