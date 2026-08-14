import {
  SHADOW_SKIN_COST,
  TITLE_FRAME_COST,
  type ShadowSkinId,
  type TitleFrameId,
} from "@/core/economy/pricing";

/**
 * The cosmetic catalog is constants, not data: three skins, three frames
 * and three panel ids, none of which any hunter can ever add to. There is no
 * cosmetic table anywhere in this phase — ownership lives in `store_unlock`
 * and what is worn lives on the row it decorates.
 *
 * Skins and frames are deliberately FLAT: they differ in style, never in
 * rarity. "Grade" already means something fixed in this app — the thing
 * that drops out of real training — and putting a gold-bought item on that
 * same ladder would blur the earned/bought line the economy exists to keep.
 */
export type ShadowSkinDef = {
  readonly id: ShadowSkinId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
};

export const SHADOW_SKIN_CATALOG: readonly ShadowSkinDef[] = [
  {
    id: "ember",
    name: "Ember",
    description: "A warm gradient and a slow, breathing amber glow.",
    cost: SHADOW_SKIN_COST.ember,
  },
  {
    id: "frost",
    name: "Frost",
    description: "A cold gradient and a sharper, faster pulse of ice.",
    cost: SHADOW_SKIN_COST.frost,
  },
  {
    id: "void",
    name: "Void",
    description: "A slow violet-to-black shift with a dark, heavy glow.",
    cost: SHADOW_SKIN_COST.void,
  },
];

export function isShadowSkinId(value: string): value is ShadowSkinId {
  return SHADOW_SKIN_CATALOG.some((skin) => skin.id === value);
}

export type TitleFrameDef = {
  readonly id: TitleFrameId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
};

/**
 * The three frames follow the game's own colour ladder — System blue,
 * Monarch violet, then black and gold — rather than a generic
 * bronze/silver/gold scale. Those colours already mean something here; a
 * "silver" frame would mean nothing.
 */
export const TITLE_FRAME_CATALOG: readonly TitleFrameDef[] = [
  {
    id: "system",
    name: "System Frame",
    description: "A thin System-blue border around the title you wear.",
    cost: TITLE_FRAME_COST.system,
  },
  {
    id: "monarch",
    name: "Monarch Frame",
    description: "The Monarch's violet, drawn around the title you wear.",
    cost: TITLE_FRAME_COST.monarch,
  },
  {
    id: "sovereign",
    name: "Sovereign Frame",
    description: "Gold on black, the Shadow Sovereign's own colours.",
    cost: TITLE_FRAME_COST.sovereign,
  },
];

export function isTitleFrameId(value: string): value is TitleFrameId {
  return TITLE_FRAME_CATALOG.some((frame) => frame.id === value);
}

/** One unlock row, bought once; rearranging afterwards is free forever. */
export const DASHBOARD_LAYOUT_UNLOCK_KEY = "cosmetic:dashboard-layout";

/**
 * Ownership is per (skin, shadow) pair — 27 independent facts, not three.
 * Buying Void for Igris leaves Void locked on every other shadow, which is
 * what turns choosing a skin into the question of which shadow, and so
 * which muscle group, is worth marking.
 */
export function shadowSkinKey(skinId: string, shadowId: string): string {
  return `shadow-skin:${skinId}:${shadowId}`;
}

export function titleFrameKey(frameId: string): string {
  return `title-frame:${frameId}`;
}

/**
 * The draggable Dashboard panels. The warning panels above them — the
 * System Voice message, a narrative reveal, the Job Change banner — are
 * pinned and are NOT in this set: their order encodes a deliberate
 * priority, and a drag must not be able to reorder a penalty warning below
 * a purchase button. "TODAY — REST" is information rather than an action,
 * so it is not draggable either and renders after this block.
 *
 * "run-log" is deliberately absent: logging a run moved to the Quests page,
 * since it satisfies the Daily Quest's always-on baseline, not a panel tied
 * to which day the lifting schedule opens a gate.
 */
export type DashboardPanelId =
  "daily-quest" | "todays-gate" | "instant-dungeon-key";

export const DEFAULT_DASHBOARD_ORDER: readonly DashboardPanelId[] = [
  "daily-quest",
  "todays-gate",
  "instant-dungeon-key",
];
