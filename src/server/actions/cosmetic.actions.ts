"use server";

import { z } from "zod";
import { hasWriteAccess } from "@/server/auth/guard";
import { getContainer } from "@/server/container";
import {
  buyCosmetic,
  type BuyCosmeticResult,
} from "@/app-services/buy-cosmetic";
import { buyAura, type BuyAuraResult } from "@/app-services/buy-aura";
import {
  equipShadowSkin,
  type EquipShadowSkinResult,
} from "@/app-services/equip-shadow-skin";
import {
  equipTitleFrame,
  type EquipTitleFrameResult,
} from "@/app-services/equip-title-frame";
import {
  saveDashboardOrder,
  type SaveDashboardOrderResult,
} from "@/app-services/save-dashboard-order";
import type { ActionResult } from "./action-result";

/**
 * Every action here returns its failure as data. A thrown domain error
 * reaches the browser as an opaque digest in a production build, which is
 * indistinguishable from the app being down at exactly the moment the
 * hunter is spending gold.
 *
 * The ids are validated for SHAPE here and for MEANING in the app-service.
 * Zod cannot know whether a skin is in the catalog or a pair has been
 * bought, and duplicating the catalog into a z.enum would create a second
 * copy of it to keep in step.
 */

const buyCosmeticSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dashboard-layout") }),
  z.object({
    kind: z.literal("shadow-skin"),
    skinId: z.string().min(1).max(32),
    shadowId: z.string().min(1).max(64),
  }),
  z.object({
    kind: z.literal("title-frame"),
    frameId: z.string().min(1).max(32),
  }),
]);

export async function buyCosmeticAction(
  input: unknown,
): Promise<ActionResult<BuyCosmeticResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = buyCosmeticSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await buyCosmetic(getContainer(), parsed.data);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

export async function buyAuraAction(): Promise<ActionResult<BuyAuraResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const result = await buyAura(getContainer());
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const equipShadowSkinSchema = z.object({
  shadowId: z.string().min(1).max(64),
  skinId: z.string().min(1).max(32).nullable(),
});

export async function equipShadowSkinAction(
  input: unknown,
): Promise<ActionResult<EquipShadowSkinResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = equipShadowSkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await equipShadowSkin(
    getContainer(),
    parsed.data.shadowId,
    parsed.data.skinId,
  );
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const equipTitleFrameSchema = z.object({
  frameId: z.string().min(1).max(32).nullable(),
});

export async function equipTitleFrameAction(
  input: unknown,
): Promise<ActionResult<EquipTitleFrameResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = equipTitleFrameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await equipTitleFrame(getContainer(), parsed.data.frameId);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}

const saveDashboardOrderSchema = z.object({
  // Bounded so no client can post a thousand ids; the app-service
  // normalizes the contents against the real panel set regardless.
  order: z.array(z.string().min(1).max(64)).max(16),
});

export async function saveDashboardOrderAction(
  input: unknown,
): Promise<ActionResult<SaveDashboardOrderResult>> {
  if (!(await hasWriteAccess())) return { ok: false, error: "unauthorized" };

  const parsed = saveDashboardOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const result = await saveDashboardOrder(getContainer(), parsed.data.order);
  if (!result.ok) return { ok: false, error: result.error.type };
  return { ok: true, value: result.value };
}
