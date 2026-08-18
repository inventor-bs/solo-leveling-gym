import {
  AURA_VISUAL_MAX_LEVEL,
  DASHBOARD_LAYOUT_COST,
  VOICE_OF_THE_RULER_COST,
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
import {
  COLD_VOICE,
  VOICE_OF_THE_RULER_UNLOCK_KEY,
  VOICE_TONE_CATALOG,
  type VoiceToneId,
} from "@/core/system-voice/tone";
import { resolveVoiceTone } from "./active-voice-tone";
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

export type CosmeticVoiceToneOption = {
  /** null is Cold — the default voice, which is not for sale. */
  toneId: VoiceToneId | null;
  name: string;
  description: string;
  /** One line in this voice, shown before AND after the purchase. */
  sample: string;
  active: boolean;
};

export type CosmeticVoiceToneView = {
  owned: boolean;
  cost: number;
  affordable: boolean;
  available: boolean;
  active: VoiceToneId | null;
  /** Four entries: Cold, then the three the one purchase unlocks. */
  options: CosmeticVoiceToneOption[];
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
  voiceTone: CosmeticVoiceToneView;
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

  // Asked of the one resolver rather than read off the row: there must be a
  // single definition of which voice is live, or the Store will eventually
  // show one selected that the System is not using.
  const activeTone = await resolveVoiceTone(container);
  const voiceOwned = unlocked.has(VOICE_OF_THE_RULER_UNLOCK_KEY);
  const voiceAffordable = hunter.gold >= VOICE_OF_THE_RULER_COST;

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
    voiceTone: {
      owned: voiceOwned,
      cost: VOICE_OF_THE_RULER_COST,
      affordable: voiceAffordable,
      available: !voiceOwned && voiceAffordable,
      active: activeTone,
      options: [
        {
          toneId: null,
          name: COLD_VOICE.name,
          description: COLD_VOICE.description,
          sample: COLD_VOICE.sample,
          active: activeTone === null,
        },
        ...VOICE_TONE_CATALOG.map((tone) => ({
          toneId: tone.id,
          name: tone.name,
          description: tone.description,
          sample: tone.sample,
          active: activeTone === tone.id,
        })),
      ],
    },
  };
}
