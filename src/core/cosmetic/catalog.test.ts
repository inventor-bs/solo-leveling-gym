import { describe, it, expect } from "vitest";
import { SHADOW_SKIN_COST, TITLE_FRAME_COST } from "@/core/economy/pricing";
import {
  SHADOW_SKIN_CATALOG,
  TITLE_FRAME_CATALOG,
  isShadowSkinId,
  isTitleFrameId,
  shadowSkinKey,
  titleFrameKey,
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  DEFAULT_DASHBOARD_ORDER,
} from "./catalog";

describe("SHADOW_SKIN_CATALOG", () => {
  it("lists three skins, cheapest first, with unique ids", () => {
    expect(SHADOW_SKIN_CATALOG.map((s) => s.id)).toEqual([
      "ember",
      "frost",
      "void",
    ]);
  });

  it("takes every price from the pricing module rather than restating one", () => {
    for (const skin of SHADOW_SKIN_CATALOG) {
      expect(skin.cost).toBe(SHADOW_SKIN_COST[skin.id]);
    }
  });

  it("narrows a skin id and rejects anything else", () => {
    expect(isShadowSkinId("void")).toBe(true);
    expect(isShadowSkinId("ember")).toBe(true);
    expect(isShadowSkinId("plasma")).toBe(false);
    expect(isShadowSkinId("")).toBe(false);
  });
});

describe("TITLE_FRAME_CATALOG", () => {
  it("lists three frames on the game's own rank colour ladder", () => {
    expect(TITLE_FRAME_CATALOG.map((f) => f.id)).toEqual([
      "system",
      "monarch",
      "sovereign",
    ]);
  });

  it("takes every price from the pricing module", () => {
    for (const frame of TITLE_FRAME_CATALOG) {
      expect(frame.cost).toBe(TITLE_FRAME_COST[frame.id]);
    }
  });

  it("narrows a frame id and rejects anything else", () => {
    expect(isTitleFrameId("sovereign")).toBe(true);
    expect(isTitleFrameId("bronze")).toBe(false);
  });
});

describe("unlock keys", () => {
  it("builds a shadow-skin key from the PAIR, so one shadow's skin is not another's", () => {
    expect(shadowSkinKey("void", "igris")).toBe("shadow-skin:void:igris");
    expect(shadowSkinKey("void", "tank")).toBe("shadow-skin:void:tank");
    expect(shadowSkinKey("void", "igris")).not.toBe(
      shadowSkinKey("void", "tank"),
    );
  });

  it("builds a title-frame key and a fixed dashboard-layout key", () => {
    expect(titleFrameKey("monarch")).toBe("title-frame:monarch");
    expect(DASHBOARD_LAYOUT_UNLOCK_KEY).toBe("cosmetic:dashboard-layout");
  });
});

describe("DEFAULT_DASHBOARD_ORDER", () => {
  it("is the four draggable action panels, in the order they render today", () => {
    expect(DEFAULT_DASHBOARD_ORDER).toEqual([
      "daily-quest",
      "todays-gate",
      "run-log",
      "instant-dungeon-key",
    ]);
  });
});
