import {
  AURA_VISUAL_MAX_LEVEL,
  DASHBOARD_LAYOUT_COST,
  type ShadowSkinId,
  type TitleFrameId,
} from "@/core/economy/pricing";
import { auraCost, auraVisualTier } from "@/core/cosmetic/aura";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  SHADOW_SKIN_CATALOG,
  TITLE_FRAME_CATALOG,
  isTitleFrameId,
  shadowSkinKey,
  titleFrameKey,
} from "@/core/cosmetic/catalog";
import type { Container } from "@/server/container";

export type CosmeticUnlockOffer = {
  key: string;
  cost: number;
  owned: boolean;
  affordable: boolean;
  /** Buyable right now: not owned and the gold is in hand. */
  available: boolean;
};

export type CosmeticSkinShadowOffer = {
  shadowId: string;
  shadowName: string;
  owned: boolean;
  affordable: boolean;
  available: boolean;
};

export type CosmeticSkinOffer = {
  skinId: ShadowSkinId;
  name: string;
  description: string;
  cost: number;
  /** One entry per EXTRACTED shadow — nothing else has a card to decorate. */
  shadows: CosmeticSkinShadowOffer[];
};

export type CosmeticFrameOffer = {
  frameId: TitleFrameId;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
  affordable: boolean;
  available: boolean;
  equipped: boolean;
};

export type CosmeticAuraView = {
  level: number;
  visualTier: number;
  maxVisualTier: number;
  /** What the NEXT purchase costs. */
  nextCost: number;
  affordable: boolean;
  /** The glow has stopped changing. Buying is still allowed, and still costs. */
  saturated: boolean;
};

export type CosmeticShadowSkinState = {
  shadowId: string;
  shadowName: string;
  equippedSkinId: string | null;
  ownedSkinIds: ShadowSkinId[];
};

export type CosmeticView = {
  gold: number;
  dashboardLayout: CosmeticUnlockOffer;
  skins: CosmeticSkinOffer[];
  frames: CosmeticFrameOffer[];
  aura: CosmeticAuraView;
  /** Feeds the per-shadow selector on the Shadow Army page. */
  shadowSkins: CosmeticShadowSkinState[];
  equippedFrameId: TitleFrameId | null;
};

/**
 * Everything cosmetic the UI reads, assembled in one pass: the Store's
 * COSMETIC section, the Shadow Army skin selectors, and the Status frame
 * selector all come from here.
 *
 * Reads the shadow rows directly rather than through getShadowArmyView.
 * Every field needed here — id, name, extraction, equipped skin — is on the
 * row, and the army view would drag in a feed read, an equipped-skill read
 * and the whole grade/weakening computation to produce three strings.
 *
 * Nothing here decides anything: each `available` flag mirrors a rule the
 * matching app-service enforces for real, exactly as getStoreView does.
 */
export async function getCosmeticView(
  container: Container,
): Promise<CosmeticView | null> {
  const hunter = await container.hunters.get();
  if (!hunter) return null;

  const unlocked = new Set(await container.store.unlockedKeys());
  const extracted = (await container.shadows.all()).filter(
    (row) => row.extractedAt !== null,
  );

  const layoutOwned = unlocked.has(DASHBOARD_LAYOUT_UNLOCK_KEY);
  const layoutAffordable = hunter.gold >= DASHBOARD_LAYOUT_COST;

  const skins: CosmeticSkinOffer[] = SHADOW_SKIN_CATALOG.map((skin) => {
    const affordable = hunter.gold >= skin.cost;
    return {
      skinId: skin.id,
      name: skin.name,
      description: skin.description,
      cost: skin.cost,
      shadows: extracted.map((row) => {
        const owned = unlocked.has(shadowSkinKey(skin.id, row.id));
        return {
          shadowId: row.id,
          shadowName: row.name,
          owned,
          affordable,
          available: !owned && affordable,
        };
      }),
    };
  });

  // Bound to a local const first so the isTitleFrameId narrowing survives
  // the unlocked.has() call and produces a TitleFrameId, not a string.
  const storedFrame = hunter.titleFrame;
  const wornFrame =
    storedFrame !== null &&
    isTitleFrameId(storedFrame) &&
    unlocked.has(titleFrameKey(storedFrame))
      ? storedFrame
      : null;

  const frames: CosmeticFrameOffer[] = TITLE_FRAME_CATALOG.map((frame) => {
    const owned = unlocked.has(titleFrameKey(frame.id));
    const affordable = hunter.gold >= frame.cost;
    return {
      frameId: frame.id,
      name: frame.name,
      description: frame.description,
      cost: frame.cost,
      owned,
      affordable,
      available: !owned && affordable,
      equipped: wornFrame === frame.id,
    };
  });

  const nextCost = auraCost(hunter.auraLevel);

  return {
    gold: hunter.gold,
    dashboardLayout: {
      key: DASHBOARD_LAYOUT_UNLOCK_KEY,
      cost: DASHBOARD_LAYOUT_COST,
      owned: layoutOwned,
      affordable: layoutAffordable,
      available: !layoutOwned && layoutAffordable,
    },
    skins,
    frames,
    aura: {
      level: hunter.auraLevel,
      visualTier: auraVisualTier(hunter.auraLevel),
      maxVisualTier: AURA_VISUAL_MAX_LEVEL,
      nextCost,
      affordable: hunter.gold >= nextCost,
      saturated: hunter.auraLevel >= AURA_VISUAL_MAX_LEVEL,
    },
    shadowSkins: extracted.map((row) => ({
      shadowId: row.id,
      shadowName: row.name,
      equippedSkinId: row.equippedSkinId,
      ownedSkinIds: SHADOW_SKIN_CATALOG.filter((skin) =>
        unlocked.has(shadowSkinKey(skin.id, row.id)),
      ).map((skin) => skin.id),
    })),
    equippedFrameId: wornFrame,
  };
}
