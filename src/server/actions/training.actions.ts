"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { startSession } from "@/app-services/start-session";
import { logSet } from "@/app-services/log-set";
import { completeSession } from "@/app-services/complete-session";
import { logRun } from "@/app-services/log-run";

const startSessionSchema = z.object({
  programDayId: z.string().min(1),
});

export async function startSessionAction(input: unknown) {
  await requireWriteAccess();
  const parsed = startSessionSchema.parse(input);
  const result = await startSession(getContainer(), {
    ...parsed,
    clientActionId: randomUUID(),
  });
  if (!result.ok) throw new Error(result.error.type);
  return result.value;
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

export async function logSetAction(input: unknown) {
  await requireWriteAccess();
  const parsed = logSetSchema.parse(input);
  const result = await logSet(getContainer(), {
    ...parsed,
    clientActionId: parsed.clientActionId ?? randomUUID(),
  });
  if (!result.ok) throw new Error(result.error.type);
  return result.value;
}

const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export async function completeSessionAction(input: unknown) {
  await requireWriteAccess();
  const parsed = completeSessionSchema.parse(input);
  const result = await completeSession(getContainer(), {
    ...parsed,
    clientActionId: randomUUID(),
  });
  if (!result.ok) throw new Error(result.error.type);
  return result.value;
}

const logRunSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceKm: z.number().positive(),
  durationSec: z.number().int().positive(),
});

export async function logRunAction(input: unknown) {
  await requireWriteAccess();
  const parsed = logRunSchema.parse(input);
  const result = await logRun(getContainer(), {
    ...parsed,
    clientActionId: randomUUID(),
  });
  // logRun's error type is `never`, so this branch is unreachable —
  // still handled explicitly rather than asserting the type away.
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}
