"use server";

import { z } from "zod";
import { requireWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import { SHADOW_ROSTER } from "@/core/shadow/roster";
import { TITLE_CATALOG } from "@/core/title/catalog";

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

  const now = container.clock.now();
  await container.shadows.seed(
    SHADOW_ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      muscle: s.muscle,
      extractedAt: s.startsExtracted ? now : null,
    })),
  );

  await container.titles.seed(
    TITLE_CATALOG.map((t) => ({ id: t.id, name: t.name, earnedAt: null })),
  );

  return { ok: true };
}
