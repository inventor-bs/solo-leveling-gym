"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import {
  startSession,
  type StartSessionResult,
} from "@/app-services/start-session";
import { logSet, type LogSetResult } from "@/app-services/log-set";
import {
  completeSession,
  type CompleteSessionResult,
} from "@/app-services/complete-session";
import { logRun, type LogRunResult } from "@/app-services/log-run";
import type { ActionResult } from "./action-result";

const startSessionSchema = z.object({
  programDayId: z.string().min(1),
});

export async function startSessionAction(
  input: unknown,
): Promise<ActionResult<StartSessionResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await startSession(getContainer(), {
    ...parsed.data,
    clientActionId: randomUUID(),
  });
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const logSetSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setIndex: z.number().int().min(0),
  reps: z.number().int().min(0),
  weight: z.number().min(0),
  completed: z.boolean(),
  clientActionId: z.string().min(1).optional(),
});

export async function logSetAction(
  input: unknown,
): Promise<ActionResult<LogSetResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = logSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await logSet(getContainer(), {
    ...parsed.data,
    clientActionId: parsed.data.clientActionId ?? randomUUID(),
  });
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export async function completeSessionAction(
  input: unknown,
): Promise<ActionResult<CompleteSessionResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = completeSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await completeSession(getContainer(), {
    ...parsed.data,
    clientActionId: randomUUID(),
  });
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const logRunSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceKm: z.number().positive(),
  durationSec: z.number().int().positive(),
});

export async function logRunAction(
  input: unknown,
): Promise<ActionResult<LogRunResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = logRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await logRun(getContainer(), {
    ...parsed.data,
    clientActionId: randomUUID(),
  });
  // logRun's error type is `never`, so this branch is unreachable — kept
  // so a future failure mode can't slip through as a silent success.
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, value: result.value };
}
