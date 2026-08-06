"use server";

import { z } from "zod";
import { requireWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";

const schema = z.object({
  name: z.string().min(1).max(64),
  reasonForHunting: z.string().min(1).max(500),
});

export async function completeOnboardingAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireWriteAccess();
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }

  const container = getContainer();
  const existing = await container.hunters.get();
  if (existing) {
    return { ok: false, error: "already-onboarded" };
  }

  await container.hunters.create({
    name: parsed.data.name,
    createdAt: container.clock.now(),
  });
  await container.hunters.update({
    reasonForHunting: parsed.data.reasonForHunting,
  });

  return { ok: true };
}
