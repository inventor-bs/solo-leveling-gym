import { ok, err, type Result } from "@/core/shared/result";
import type { DomainEvent } from "@/core/shared/events";
import { toTrainingDay } from "@/core/shared/training-day";
import {
  DASHBOARD_LAYOUT_COST,
  SHADOW_SKIN_COST,
  TITLE_FRAME_COST,
} from "@/core/economy/pricing";
import {
  DASHBOARD_LAYOUT_UNLOCK_KEY,
  isShadowSkinId,
  isTitleFrameId,
  shadowSkinKey,
  titleFrameKey,
} from "@/core/cosmetic/catalog";
import type { Container } from "@/server/container";
import { spendGold } from "./spend-gold";

export type BuyCosmeticInput =
  | { kind: "dashboard-layout" }
  | { kind: "shadow-skin"; skinId: string; shadowId: string }
  | { kind: "title-frame"; frameId: string };

export type BuyCosmeticResult = {
  key: string;
  cost: number;
  goldRemaining: number;
  events: DomainEvent[];
};

export type BuyCosmeticError =
  | { type: "hunter-not-found" }
  | { type: "unknown-cosmetic" }
  | { type: "shadow-not-found" }
  | { type: "shadow-not-extracted" }
  | { type: "already-unlocked" }
  | { type: "insufficient-gold" };

type ResolvedPurchase = { key: string; cost: number; source: string };

/**
 * Buys any of the three one-time cosmetics.
 *
 * All three are "owned once, never consumed", which is exactly the shape
 * store_unlock was built for — the row's existence IS the ownership, so no
 * new table and no new repo method are needed for any of them.
 *
 * Every check runs before spendGold, so a refused purchase always leaves
 * the hunter's gold exactly where it was. That matters most for the repeat
 * purchase: the unlock key already existing is the whole idempotency
 * guard, and it must cost nothing to hit it.
 */
export async function buyCosmetic(
  container: Container,
  input: BuyCosmeticInput,
): Promise<Result<BuyCosmeticResult, BuyCosmeticError>> {
  const resolved = await resolve(container, input);
  if (!resolved.ok) return resolved;
  const { key, cost, source } = resolved.value;

  if (await container.store.isUnlocked(key)) {
    return err({ type: "already-unlocked" });
  }

  const spent = await spendGold(container, cost, source);
  if (!spent.ok) return err(spent.error);

  const now = container.clock.now();
  const today = toTrainingDay(now, container.tzOffsetMinutes);
  await container.store.unlock(key, now);

  const events: DomainEvent[] = [spent.value.event];
  await container.events.record(events, today, now);

  return ok({ key, cost, goldRemaining: spent.value.goldRemaining, events });
}

async function resolve(
  container: Container,
  input: BuyCosmeticInput,
): Promise<Result<ResolvedPurchase, BuyCosmeticError>> {
  switch (input.kind) {
    case "dashboard-layout":
      return ok({
        key: DASHBOARD_LAYOUT_UNLOCK_KEY,
        cost: DASHBOARD_LAYOUT_COST,
        source: "cosmetic:dashboard-layout",
      });

    case "shadow-skin": {
      // Destructured into consts before the guard so the narrowing to
      // ShadowSkinId still holds after the await below.
      const { skinId, shadowId } = input;
      if (!isShadowSkinId(skinId)) return err({ type: "unknown-cosmetic" });

      const shadow = await container.shadows.byId(shadowId);
      if (!shadow) return err({ type: "shadow-not-found" });
      // A shadow that has not been extracted renders as a silhouette with
      // a question mark; there is nothing there to decorate yet.
      if (shadow.extractedAt === null) {
        return err({ type: "shadow-not-extracted" });
      }
      return ok({
        key: shadowSkinKey(skinId, shadowId),
        cost: SHADOW_SKIN_COST[skinId],
        source: "cosmetic:shadow-skin",
      });
    }

    case "title-frame": {
      const { frameId } = input;
      if (!isTitleFrameId(frameId)) return err({ type: "unknown-cosmetic" });
      return ok({
        key: titleFrameKey(frameId),
        cost: TITLE_FRAME_COST[frameId],
        source: "cosmetic:title-frame",
      });
    }
  }
}
