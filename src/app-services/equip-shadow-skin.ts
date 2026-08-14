import { ok, err, type Result } from "@/core/shared/result";
import { isShadowSkinId, shadowSkinKey } from "@/core/cosmetic/catalog";
import type { Container } from "@/server/container";

export type EquipShadowSkinResult = {
  shadowId: string;
  equippedSkinId: string | null;
};

export type EquipShadowSkinError =
  | { type: "shadow-not-found" }
  | { type: "shadow-not-extracted" }
  | { type: "unknown-cosmetic" }
  | { type: "cosmetic-not-owned" };

/**
 * Puts an owned skin on a shadow, or takes one off. Free and unlimited —
 * the purchase was the permanent part.
 *
 * Ownership is checked against the (skin, shadow) PAIR. Owning Void on
 * Igris grants nothing on Tank, which is the whole reason this cosmetic
 * asks which shadow is worth marking.
 *
 * Taking a skin off is never blocked, whatever is owned: a hunter must
 * always be able to get back to the plain card.
 */
export async function equipShadowSkin(
  container: Container,
  shadowId: string,
  skinId: string | null,
): Promise<Result<EquipShadowSkinResult, EquipShadowSkinError>> {
  const shadow = await container.shadows.byId(shadowId);
  if (!shadow) return err({ type: "shadow-not-found" });
  if (shadow.extractedAt === null) {
    return err({ type: "shadow-not-extracted" });
  }

  if (skinId === null) {
    await container.shadows.equipSkin(shadowId, null);
    return ok({ shadowId, equippedSkinId: null });
  }

  if (!isShadowSkinId(skinId)) return err({ type: "unknown-cosmetic" });

  const owned = await container.store.isUnlocked(
    shadowSkinKey(skinId, shadowId),
  );
  if (!owned) return err({ type: "cosmetic-not-owned" });

  await container.shadows.equipSkin(shadowId, skinId);
  return ok({ shadowId, equippedSkinId: skinId });
}
